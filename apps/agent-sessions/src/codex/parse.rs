use dot::json::Value;

use crate::js;
use crate::json::{Fields, text_content};
use crate::model::{EntryKind, JsonObject, LogEntry, TurnEvent};
use crate::text::sanitize;

/// Matches `^-\w*c$`, the flag of a `zsh -lc '<script>'` style invocation.
fn is_shell_script_flag(arg: &str) -> bool {
    arg.strip_prefix('-')
        .and_then(|rest| rest.strip_suffix('c'))
        .is_some_and(|middle| {
            middle
                .chars()
                .all(|char| char.is_ascii_alphanumeric() || char == '_')
        })
}

fn command_text(command: &[Value]) -> String {
    let parts: Vec<&str> = command.iter().filter_map(Value::as_str).collect();
    match parts[..] {
        [_, flag, script] if is_shell_script_flag(flag) => script.to_string(),
        _ => parts.join(" "),
    }
}

fn last_lines(text: &str, count: usize) -> String {
    let lines: Vec<&str> = js::trim_end(text).split('\n').collect();
    lines[lines.len().saturating_sub(count)..].join("\n")
}

fn failed_or(item: &JsonObject, kind: EntryKind) -> EntryKind {
    if item.str("status") == Some("failed") {
        EntryKind::Error
    } else {
        kind
    }
}

fn command_entries(item: &JsonObject, time: Option<f64>) -> Vec<LogEntry> {
    let call = LogEntry::titled(
        time,
        EntryKind::Tool,
        "exec",
        sanitize(&format!("$ {}", command_text(item.array("command")))),
    );
    let output = last_lines(item.str("aggregated_output").unwrap_or(""), 20);
    let failed_code = item
        .get("exit_code")
        .and_then(Value::as_f64)
        .filter(|code| *code != 0.0);
    let result = match failed_code {
        Some(code) => {
            let exit = format!("exit {}", js::number_to_string(code));
            let text = if output.is_empty() {
                exit
            } else {
                format!("{exit}\n{output}")
            };
            Some(LogEntry::new(time, EntryKind::Error, sanitize(&text)))
        }
        None if !output.is_empty() => {
            Some(LogEntry::new(time, EntryKind::Result, sanitize(&output)))
        }
        None => None,
    };
    std::iter::once(call).chain(result).collect()
}

fn file_change_entry(item: &JsonObject, time: Option<f64>) -> LogEntry {
    let changes: Vec<String> = js::property_order(item.object("changes"))
        .into_iter()
        .map(|(path, change)| {
            let kind = change
                .as_object()
                .and_then(|change| change.str("type"))
                .unwrap_or("change");
            format!("{kind} {path}")
        })
        .collect();
    LogEntry::titled(
        time,
        failed_or(item, EntryKind::Tool),
        "edit",
        sanitize(&changes.join("\n")),
    )
}

fn mcp_call_entry(item: &JsonObject, time: Option<f64>) -> LogEntry {
    let arguments = match item.get("arguments") {
        None | Some(Value::Null) => "{}".to_string(),
        Some(value) => js::stringify(value),
    };
    let tool = format!(
        "{}.{}",
        item.str("server").unwrap_or("mcp"),
        item.str("tool").unwrap_or("")
    );
    LogEntry::titled(
        time,
        failed_or(item, EntryKind::Tool),
        sanitize(&tool),
        sanitize(&arguments),
    )
}

fn item_entries(item: &JsonObject, time: Option<f64>) -> Vec<LogEntry> {
    let entry = match item.str("type") {
        Some("UserMessage") => LogEntry::new(
            time,
            EntryKind::User,
            sanitize(&text_content(item.get("content"), "")),
        ),
        Some("AgentMessage") => LogEntry::new(
            time,
            EntryKind::Assistant,
            sanitize(&text_content(item.get("content"), "")),
        ),
        Some("Reasoning") => {
            let summary = item
                .array("summary_text")
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join("\n");
            if summary.is_empty() {
                return Vec::new();
            }
            LogEntry::new(time, EntryKind::Thinking, sanitize(&summary))
        }
        Some("CommandExecution") => return command_entries(item, time),
        Some("FileChange") => file_change_entry(item, time),
        Some("McpToolCall") => mcp_call_entry(item, time),
        Some("Extension") => LogEntry::titled(
            time,
            EntryKind::Tool,
            sanitize(item.str("kind").unwrap_or("extension")),
            sanitize(item.str("query").unwrap_or("")),
        ),
        Some("SubAgentActivity") => LogEntry::new(
            time,
            EntryKind::Status,
            sanitize(&format!(
                "subagent {} {}",
                item.str("kind").unwrap_or(""),
                item.str("agent_path").unwrap_or("")
            )),
        ),
        _ => return Vec::new(),
    };
    vec![entry]
}

fn event_entries(payload: &JsonObject, time: Option<f64>) -> Vec<LogEntry> {
    let status = |text: &str| vec![LogEntry::new(time, EntryKind::Status, text)];
    match payload.str("type") {
        Some("item_completed") => item_entries(payload.object("item"), time),
        Some("task_started") => status("turn started"),
        Some("task_complete") => status("turn complete"),
        Some("turn_aborted") => status(&format!(
            "turn aborted ({})",
            payload.str("reason").unwrap_or("unknown")
        )),
        Some("error" | "stream_error") => vec![LogEntry::new(
            time,
            EntryKind::Error,
            sanitize(payload.str("message").unwrap_or("error")),
        )],
        _ => Vec::new(),
    }
}

pub fn parse_codex_record(record: &JsonObject) -> Vec<LogEntry> {
    let time = record.time("timestamp");
    match record.str("type") {
        Some("compacted") => vec![LogEntry::new(time, EntryKind::Status, "context compacted")],
        Some("event_msg") => event_entries(record.object("payload"), time),
        _ => Vec::new(),
    }
}

pub fn codex_model(records: &[JsonObject]) -> Option<String> {
    records.iter().rev().find_map(|record| {
        let payload = record.object("payload");
        let model = match record.str("type") {
            Some("turn_context") => payload.non_empty_str("model"),
            Some("event_msg") if payload.str("type") == Some("thread_settings_applied") => {
                payload.object("thread_settings").non_empty_str("model")
            }
            _ => None,
        };
        model.map(str::to_string)
    })
}

pub fn codex_turn_event(record: &JsonObject) -> Option<TurnEvent> {
    if record.str("type") != Some("event_msg") {
        return None;
    }
    let payload = record.object("payload");
    match payload.str("type")? {
        "task_started" => Some(TurnEvent::Start(record.time("timestamp"))),
        "task_complete" | "turn_aborted" => {
            let at = record.time("timestamp");
            Some(
                payload
                    .get("duration_ms")
                    .and_then(Value::as_f64)
                    .filter(|elapsed| elapsed.is_finite() && *elapsed >= 0.0)
                    .map_or(TurnEvent::Finish(at), |elapsed| TurnEvent::Duration {
                        elapsed,
                        at,
                    }),
            )
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::object;
    use dot::json::json;

    const TIMESTAMP: &str = "2026-11-15T13:13:06.042Z";

    fn time() -> Option<f64> {
        js::date_parse(TIMESTAMP)
    }

    fn event(payload: Value) -> JsonObject {
        object(json!({"type": "event_msg", "timestamp": TIMESTAMP, "payload": payload}))
    }

    fn item(value: Value) -> JsonObject {
        event(json!({"type": "item_completed", "item": value}))
    }

    #[test]
    fn parses_completed_items() {
        let entries: Vec<LogEntry> = [
            item(json!({"type": "UserMessage", "content": [{"type": "text", "text": "hi"}]})),
            item(json!({"type": "AgentMessage", "content": [{"type": "Text", "text": "yo"}]})),
            item(json!({
                "type": "CommandExecution",
                "command": ["/bin/zsh", "-lc", "git status"],
                "aggregated_output": "clean\n",
                "exit_code": 0,
            })),
            item(json!({
                "type": "CommandExecution",
                "command": ["false"],
                "aggregated_output": "",
                "exit_code": 1,
            })),
            item(json!({"type": "FileChange", "changes": {"/a.ts": {"type": "update"}}})),
            item(json!({"type": "Reasoning", "summary_text": []})),
        ]
        .iter()
        .flat_map(parse_codex_record)
        .collect();
        assert_eq!(
            entries,
            [
                LogEntry::new(time(), EntryKind::User, "hi"),
                LogEntry::new(time(), EntryKind::Assistant, "yo"),
                LogEntry::titled(time(), EntryKind::Tool, "exec", "$ git status"),
                LogEntry::new(time(), EntryKind::Result, "clean"),
                LogEntry::titled(time(), EntryKind::Tool, "exec", "$ false"),
                LogEntry::new(time(), EntryKind::Error, "exit 1"),
                LogEntry::titled(time(), EntryKind::Tool, "edit", "update /a.ts"),
            ]
        );
    }

    #[test]
    fn reads_turn_boundaries_from_lifecycle_events() {
        assert_eq!(
            codex_turn_event(&event(json!({"type": "task_started"}))),
            Some(TurnEvent::Start(time()))
        );
        for kind in ["task_complete", "turn_aborted"] {
            assert_eq!(
                codex_turn_event(&event(json!({"type": kind}))),
                Some(TurnEvent::Finish(time()))
            );
            assert_eq!(
                codex_turn_event(&event(json!({"type": kind, "duration_ms": 1234}))),
                Some(TurnEvent::Duration {
                    elapsed: 1234.0,
                    at: time(),
                })
            );
        }
        assert_eq!(
            codex_turn_event(&event(json!({"type": "task_complete", "duration_ms": -1}))),
            Some(TurnEvent::Finish(time()))
        );
        assert_eq!(
            codex_turn_event(&event(json!({"type": "token_count"}))),
            None
        );
        assert_eq!(
            codex_turn_event(&object(
                json!({"type":"event_msg", "payload":{"type":"task_started"}})
            )),
            Some(TurnEvent::Start(None))
        );
    }

    #[test]
    fn uses_the_latest_codex_turn_context_or_thread_settings() {
        assert_eq!(
            codex_model(&[
                event(json!({
                    "type": "thread_settings_applied",
                    "thread_settings": {"model": "gpt-6.1-sol"},
                })),
                object(json!({"type": "turn_context", "payload": {"model": "gpt-6.1-luna"}})),
                event(json!({"type": "token_count"})),
            ])
            .as_deref(),
            Some("gpt-6.1-luna")
        );
        assert_eq!(
            codex_model(&[event(json!({
                "type": "thread_settings_applied",
                "thread_settings": {"model": "gpt-6.1-sol"},
            }))])
            .as_deref(),
            Some("gpt-6.1-sol")
        );
    }
}
