use dot::json::Value;

use crate::js;
use crate::json::{Fields, object_or_empty, objects, text_content};
use crate::model::{EntryKind, JsonObject, LogEntry, SessionStatus, TurnEvent};
use crate::text::{one_line, sanitize};

const TOOL_INPUT_KEYS: [&str; 10] = [
    "command",
    "file_path",
    "notebook_path",
    "path",
    "pattern",
    "url",
    "query",
    "skill",
    "description",
    "prompt",
];

pub fn summarize_tool_input(input: Option<&Value>) -> String {
    let fields = object_or_empty(input);
    let parts: Vec<String> = TOOL_INPUT_KEYS
        .iter()
        .filter_map(|&key| {
            let value = fields.non_empty_str(key)?;
            Some(if key == "command" {
                format!("$ {value}")
            } else {
                value.to_string()
            })
        })
        .take(2)
        .collect();
    if !parts.is_empty() {
        return parts.join("\n");
    }
    match input.map(js::stringify) {
        Some(json) if json != "{}" => json,
        _ => String::new(),
    }
}

fn user_entries(record: &JsonObject, time: Option<f64>) -> Vec<LogEntry> {
    let content = record.object("message").get("content");
    if let Some(Value::String(text)) = content {
        return vec![LogEntry::new(time, EntryKind::User, sanitize(text))];
    }
    objects(content.and_then(Value::as_array).map_or(&[], Vec::as_slice))
        .filter_map(|item| match item.str("type")? {
            "text" => Some(LogEntry::new(
                time,
                EntryKind::User,
                sanitize(item.str("text").unwrap_or("")),
            )),
            "tool_result" => Some(LogEntry::new(
                time,
                if item.is_true("is_error") {
                    EntryKind::Error
                } else {
                    EntryKind::Result
                },
                sanitize(&text_content(item.get("content"), "\n")),
            )),
            _ => None,
        })
        .collect()
}

fn assistant_entries(record: &JsonObject, time: Option<f64>) -> Vec<LogEntry> {
    objects(record.object("message").array("content"))
        .filter_map(|item| match item.str("type")? {
            "text" => Some(LogEntry::new(
                time,
                EntryKind::Assistant,
                sanitize(item.str("text").unwrap_or("")),
            )),
            "thinking" => item
                .non_empty_str("thinking")
                .map(|thinking| LogEntry::new(time, EntryKind::Thinking, sanitize(thinking))),
            "tool_use" => Some(LogEntry::titled(
                time,
                EntryKind::Tool,
                sanitize(item.str("name").unwrap_or("tool")),
                sanitize(&summarize_tool_input(item.get("input"))),
            )),
            _ => None,
        })
        .collect()
}

fn system_entry(record: &JsonObject, time: Option<f64>) -> Option<LogEntry> {
    match record.str("subtype")? {
        "compact_boundary" => Some(LogEntry::new(time, EntryKind::Status, "context compacted")),
        "api_error" => Some(LogEntry::new(
            time,
            EntryKind::Error,
            "API error (retrying)",
        )),
        _ => None,
    }
}

pub fn parse_claude_record(record: &JsonObject) -> Vec<LogEntry> {
    let time = record.time("timestamp");
    match record.str("type") {
        Some("user") if !record.is_true("isMeta") => user_entries(record, time),
        Some("assistant") => assistant_entries(record, time),
        Some("system") => system_entry(record, time).into_iter().collect(),
        _ => Vec::new(),
    }
}

pub fn claude_title(records: &[JsonObject]) -> Option<String> {
    records.iter().rev().find_map(|record| {
        if !matches!(record.str("type"), Some("ai-title" | "custom-title")) {
            return None;
        }
        let title = record.str("customTitle").or(record.str("aiTitle"));
        title.filter(|title| !title.is_empty()).map(one_line)
    })
}

pub fn claude_model(records: &[JsonObject]) -> Option<String> {
    records.iter().rev().find_map(|record| {
        if record.str("type") != Some("assistant") {
            return None;
        }
        record
            .object("message")
            .non_empty_str("model")
            .filter(|model| *model != "<synthetic>")
            .map(str::to_string)
    })
}

fn is_interruption(text: &str) -> bool {
    matches!(
        text,
        "[Request interrupted by user]" | "[Request interrupted by user for tool use]"
    )
}

fn is_prompt_text(text: &str) -> bool {
    let text = text.trim();
    !text.is_empty()
        && ![
            "<command-name>",
            "<local-command-",
            "<system-reminder>",
            "<task-notification>",
        ]
        .iter()
        .any(|prefix| text.starts_with(prefix))
}

fn user_turn_event(record: &JsonObject, time: Option<f64>) -> Option<TurnEvent> {
    let message = record.object("message");
    let content = message.str("content");
    let blocks = message.array("content");
    let texts = objects(blocks).filter_map(|block| block.str("text"));
    if content.into_iter().chain(texts).any(is_interruption) {
        return Some(TurnEvent::Finish(time));
    }
    if record.is_true("isCompactSummary")
        || record.is_true("isVisibleInTranscriptOnly")
        || objects(blocks).any(|block| block.str("type") == Some("tool_result"))
    {
        return None;
    }
    if record.is_true("isMeta") {
        // Claude records a peer message that starts its own turn as metadata.
        let peer_turn = record.str("promptSource") == Some("system")
            && record.str("turnOrigin") == Some("peer")
            && record
                .object("turnPosition")
                .get("turnIndex")
                .and_then(Value::as_u64)
                .is_some();
        return peer_turn.then_some(TurnEvent::Start(time));
    }
    let is_prompt = content.is_some_and(is_prompt_text)
        || objects(blocks).any(|block| match block.str("type") {
            Some("text") => block.str("text").is_some_and(is_prompt_text),
            Some("image" | "document") => true,
            _ => false,
        });
    is_prompt.then_some(TurnEvent::Start(time))
}

pub fn claude_turn_event(record: &JsonObject) -> Option<TurnEvent> {
    let time = record.time("timestamp");
    match record.str("type")? {
        "user" => user_turn_event(record, time),
        "assistant" => {
            let message = record.object("message");
            // The finish reason can appear on a thinking block before the final text.
            let terminal = matches!(
                message.str("stop_reason"),
                Some("end_turn" | "stop_sequence" | "refusal")
            );
            let blocks = message.array("content");
            (terminal
                && (blocks.is_empty()
                    || objects(blocks).any(|block| {
                        !matches!(block.str("type"), Some("thinking" | "redacted_thinking"))
                    })))
            .then_some(TurnEvent::Response(time))
        }
        "system" => match record.str("subtype")? {
            "turn_duration" => Some(
                record
                    .get("durationMs")
                    .and_then(Value::as_f64)
                    .filter(|duration| duration.is_finite() && *duration >= 0.0)
                    .map_or(TurnEvent::Finish(time), |elapsed| TurnEvent::Duration {
                        elapsed,
                        at: time,
                    }),
            ),
            "stop_hook_summary"
                if record.get("preventedContinuation").and_then(Value::as_bool) == Some(false) =>
            {
                Some(TurnEvent::Finish(time))
            }
            _ => None,
        },
        _ => None,
    }
}

/// Subagents have no registry entry, and teammates never get `finished` in
/// their meta file, so an assistant message that ends the turn is the only
/// idle signal. Attachments and API bookkeeping records do not change the state.
pub fn claude_turn_status(records: &[JsonObject]) -> Option<SessionStatus> {
    records
        .iter()
        .rev()
        .find_map(|record| match record.str("type") {
            Some("user") => Some(SessionStatus::Running),
            Some("assistant") => match record.object("message").str("stop_reason")? {
                "end_turn" | "stop_sequence" | "refusal" => Some(SessionStatus::Idle),
                _ => Some(SessionStatus::Running),
            },
            _ => None,
        })
}

pub fn registry_status(status: Option<&str>) -> SessionStatus {
    match status {
        Some("busy" | "shell") => SessionStatus::Running,
        Some("idle") => SessionStatus::Idle,
        Some("waiting" | "needs_input" | "needs-input" | "blocked") => SessionStatus::Waiting,
        _ => SessionStatus::Unknown,
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::test_support::object;
    use dot::json::json;

    const TIMESTAMP: &str = "2026-11-15T13:13:06.042Z";

    fn time() -> Option<f64> {
        js::date_parse(TIMESTAMP)
    }

    #[test]
    fn parses_user_prompts_and_skips_meta_messages() {
        assert_eq!(
            parse_claude_record(&object(json!({
                "type": "user",
                "timestamp": TIMESTAMP,
                "message": {"role": "user", "content": "hello\u{1b}[31m"},
            }))),
            [LogEntry::new(time(), EntryKind::User, "hello")]
        );
        assert_eq!(
            parse_claude_record(&object(json!({
                "type": "user",
                "isMeta": true,
                "message": {"content": "hidden"},
            }))),
            []
        );
    }

    #[test]
    fn parses_assistant_text_thinking_and_tool_calls() {
        assert_eq!(
            parse_claude_record(&object(json!({
                "type": "assistant",
                "timestamp": TIMESTAMP,
                "message": {"content": [
                    {"type": "thinking", "thinking": ""},
                    {"type": "thinking", "thinking": "plan"},
                    {"type": "text", "text": "done"},
                    {"type": "tool_use", "name": "Bash", "input": {"command": "ls", "description": "List"}},
                ]},
            }))),
            [
                LogEntry::new(time(), EntryKind::Thinking, "plan"),
                LogEntry::new(time(), EntryKind::Assistant, "done"),
                LogEntry::titled(time(), EntryKind::Tool, "Bash", "$ ls\nList"),
            ]
        );
    }

    #[test]
    fn marks_failed_tool_results_as_errors() {
        assert_eq!(
            parse_claude_record(&object(json!({
                "type": "user",
                "timestamp": TIMESTAMP,
                "message": {"content": [
                    {"type": "tool_result", "is_error": true, "content": [{"type": "text", "text": "boom"}]},
                    {"type": "tool_result", "content": "ok"},
                ]},
            }))),
            [
                LogEntry::new(time(), EntryKind::Error, "boom"),
                LogEntry::new(time(), EntryKind::Result, "ok"),
            ]
        );
    }

    #[test]
    fn ignores_bookkeeping_records() {
        assert_eq!(
            parse_claude_record(&object(json!({"type": "attachment"}))),
            []
        );
        assert_eq!(
            parse_claude_record(&object(json!({"type": "api-request-blob"}))),
            []
        );
    }

    #[test]
    fn uses_the_latest_title() {
        assert_eq!(
            claude_title(&[
                object(json!({"type": "ai-title", "aiTitle": "old"})),
                object(json!({"type": "ai-title", "aiTitle": "new"})),
            ])
            .as_deref(),
            Some("new")
        );
    }

    #[test]
    fn maps_registry_status() {
        assert_eq!(registry_status(Some("busy")), SessionStatus::Running);
        assert_eq!(registry_status(Some("shell")), SessionStatus::Running);
        assert_eq!(registry_status(Some("idle")), SessionStatus::Idle);
        assert_eq!(registry_status(Some("other")), SessionStatus::Unknown);
    }

    #[test]
    fn falls_back_to_json_for_unknown_tool_input() {
        assert_eq!(summarize_tool_input(Some(&json!({"a": 1}))), r#"{"a":1}"#);
        assert_eq!(summarize_tool_input(Some(&json!({}))), "");
    }

    #[test]
    fn uses_the_latest_real_claude_model() {
        assert_eq!(
            claude_model(&[
                object(json!({"type": "assistant", "message": {"model": "claude-fable-5-2"}})),
                object(json!({"type": "assistant", "message": {"model": "claude-opus-5-5"}})),
                object(json!({"type": "assistant", "message": {"model": "<synthetic>"}})),
                object(json!({"type": "user", "message": {"content": "hi"}})),
            ])
            .as_deref(),
            Some("claude-opus-5-5")
        );
        assert_eq!(claude_model(&[]), None);
    }

    pub fn turn(kind: &str, stop_reason: Option<&str>) -> JsonObject {
        match kind {
            "assistant" => object(json!({
                "type": "assistant",
                "isSidechain": true,
                "message": {"role": "assistant", "stop_reason": stop_reason, "content": [{"type": "text", "text": "x"}]},
            })),
            "user" => object(json!({
                "type": "user",
                "isSidechain": true,
                "message": {"role": "user", "content": [{"type": "tool_result", "content": "x"}]},
            })),
            other => object(json!({"type": other, "isSidechain": true})),
        }
    }

    #[test]
    fn derives_the_turn_status_from_the_latest_turn_record() {
        assert_eq!(
            claude_turn_status(&[
                turn("user", None),
                turn("assistant", Some("end_turn")),
                turn("attachment", None),
                turn("attachment", None),
            ]),
            Some(SessionStatus::Idle)
        );
        assert_eq!(
            claude_turn_status(&[
                turn("assistant", Some("tool_use")),
                turn("api-request", None)
            ]),
            Some(SessionStatus::Running)
        );
        assert_eq!(
            claude_turn_status(&[turn("assistant", Some("tool_use")), turn("user", None)]),
            Some(SessionStatus::Running)
        );
        assert_eq!(
            claude_turn_status(&[turn("assistant", Some("end_turn")), turn("user", None)]),
            Some(SessionStatus::Running)
        );
        assert_eq!(claude_turn_status(&[turn("attachment", None)]), None);
    }

    #[test]
    fn times_turns_from_prompts_and_final_responses() {
        let event = |record| claude_turn_event(&object(record));
        assert_eq!(
            event(json!({
                "type": "user", "timestamp": 1000,
                "message": {"content": [{"type": "text", "text": "hello"}]},
            })),
            Some(TurnEvent::Start(Some(1000.0)))
        );
        assert_eq!(
            event(json!({
                "type": "user", "timestamp": 2000,
                "message": {"content": [{"type": "tool_result", "content": "ok"}]},
            })),
            None
        );
        assert_eq!(
            event(json!({
                "type": "user", "timestamp": 2200, "isMeta": true,
                "message": {"content": "hook result"},
            })),
            None
        );
        assert_eq!(
            event(json!({
                "type": "assistant", "timestamp": 2500,
                "message": {"stop_reason": "end_turn", "content": [{"type": "thinking"}]},
            })),
            None
        );
        assert_eq!(
            event(json!({
                "type": "assistant", "timestamp": 3000,
                "message": {"stop_reason": "end_turn", "content": [{"type": "text"}]},
            })),
            Some(TurnEvent::Response(Some(3000.0)))
        );
        assert_eq!(
            event(json!({
                "type": "system", "subtype": "turn_duration", "timestamp": 3100,
                "durationMs": 2075,
            })),
            Some(TurnEvent::Duration {
                elapsed: 2075.0,
                at: Some(3100.0),
            })
        );
    }

    #[test]
    fn finishes_when_stop_hooks_allow_the_turn_to_end() {
        let summary = |prevented| {
            claude_turn_event(&object(json!({
                "type": "system", "subtype": "stop_hook_summary", "timestamp": 1000,
                "preventedContinuation": prevented,
            })))
        };
        assert_eq!(summary(false), Some(TurnEvent::Finish(Some(1000.0))));
        assert_eq!(summary(true), None);
    }

    #[test]
    fn closes_an_interrupted_turn() {
        assert_eq!(
            claude_turn_event(&object(json!({
                "type": "user", "timestamp": 1000,
                "message": {"content": [{"type": "text", "text": "[Request interrupted by user]"}]},
            }))),
            Some(TurnEvent::Finish(Some(1000.0)))
        );
    }

    #[test]
    fn starts_a_turn_for_a_peer_prompt_marked_as_metadata() {
        let event = |record| claude_turn_event(&object(record));
        assert_eq!(
            event(json!({
                "type": "user", "timestamp": 1000, "isMeta": true,
                "promptSource": "system", "turnOrigin": "peer",
                "turnPosition": {"promptIndex": 131, "turnIndex": 135},
                "message": {"content": "peer message"},
            })),
            Some(TurnEvent::Start(Some(1000.0)))
        );
        assert_eq!(
            event(json!({
                "type": "user", "timestamp": 1500, "isMeta": true,
                "turnCompanion": "hook",
                "message": {"content": "hook result"},
            })),
            None
        );
    }
}
