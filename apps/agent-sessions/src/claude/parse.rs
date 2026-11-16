use serde_json::Value;

use crate::js;
use crate::json::{Fields, object_or_empty, objects, text_content};
use crate::model::{EntryKind, JsonObject, LogEntry, SessionStatus};
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
    use serde_json::json;

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
}
