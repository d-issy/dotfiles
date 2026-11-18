use crate::js;
use crate::json::{Fields, objects, text_content};
use crate::model::{EntryKind, JsonObject, LogEntry, SessionStatus, TurnEvent};
use crate::text::sanitize;

pub fn pi_status(record: &JsonObject) -> Option<SessionStatus> {
    if record.str("type") != Some("message") {
        return None;
    }
    let message = record.object("message");
    match message.str("role")? {
        "user" | "toolResult" => Some(SessionStatus::Running),
        "assistant" => Some(if message.str("stopReason") == Some("toolUse") {
            SessionStatus::Running
        } else {
            SessionStatus::Idle
        }),
        _ => None,
    }
}

pub fn pi_turn_event(record: &JsonObject) -> Option<TurnEvent> {
    if record.str("type") != Some("message") {
        return None;
    }
    let message = record.object("message");
    let time = record.time("timestamp");
    match message.str("role")? {
        "user" => Some(TurnEvent::Start(time.or_else(|| message.time("timestamp")))),
        // The entry is written after the response. The assistant message's own
        // timestamp marks the beginning of generation.
        "assistant" if message.str("stopReason") != Some("toolUse") => {
            Some(TurnEvent::Finish(time))
        }
        _ => None,
    }
}

pub fn parse_pi_record(record: &JsonObject) -> Vec<LogEntry> {
    let time = record.time("timestamp");
    match record.str("type") {
        Some("compaction" | "branch_summary") => {
            return vec![LogEntry::titled(
                time,
                EntryKind::Status,
                if record.str("type") == Some("compaction") {
                    "context compacted"
                } else {
                    "branch summary"
                },
                sanitize(record.str("summary").unwrap_or("")),
            )];
        }
        Some("custom_message") if record.is_true("display") => {
            return vec![LogEntry::titled(
                time,
                EntryKind::Status,
                sanitize(record.str("customType").unwrap_or("custom")),
                sanitize(&text_content(record.get("content"), "\n")),
            )];
        }
        Some("message") => {}
        _ => return Vec::new(),
    }
    let message = record.object("message");
    let time = time.or_else(|| message.time("timestamp"));
    match message.str("role") {
        Some("user") => vec![LogEntry::new(
            time,
            EntryKind::User,
            sanitize(&text_content(message.get("content"), "\n")),
        )],
        Some("assistant") => {
            let mut entries: Vec<_> = objects(message.array("content"))
                .filter_map(|block| {
                    let entry = match block.str("type")? {
                        "text" => LogEntry::new(
                            time,
                            EntryKind::Assistant,
                            sanitize(block.str("text").unwrap_or("")),
                        ),
                        "thinking" => LogEntry::new(
                            time,
                            EntryKind::Thinking,
                            sanitize(block.str("thinking").unwrap_or("")),
                        ),
                        "toolCall" => LogEntry::titled(
                            time,
                            EntryKind::Tool,
                            sanitize(block.str("name").unwrap_or("tool")),
                            sanitize(
                                &block
                                    .get("arguments")
                                    .map_or_else(|| "{}".into(), js::stringify),
                            ),
                        ),
                        _ => return None,
                    };
                    Some(entry)
                })
                .collect();
            if let Some(error) = message.non_empty_str("errorMessage") {
                entries.push(LogEntry::new(time, EntryKind::Error, sanitize(error)));
            }
            entries
        }
        Some("toolResult") => vec![LogEntry::titled(
            time,
            if message.is_true("isError") {
                EntryKind::Error
            } else {
                EntryKind::Result
            },
            sanitize(message.str("toolName").unwrap_or("tool")),
            sanitize(&text_content(message.get("content"), "\n")),
        )],
        Some("bashExecution") => vec![
            LogEntry::titled(
                time,
                EntryKind::Tool,
                "bash",
                sanitize(message.str("command").unwrap_or("")),
            ),
            LogEntry::new(
                time,
                if message.is_true("cancelled")
                    || message
                        .get("exitCode")
                        .and_then(dot::json::Value::as_f64)
                        .is_some_and(|code| code != 0.0)
                {
                    EntryKind::Error
                } else {
                    EntryKind::Result
                },
                sanitize(message.str("output").unwrap_or("")),
            ),
        ],
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::object;
    use dot::json::json;

    #[test]
    fn parses_assistant_blocks_and_tool_results() {
        let record = object(json!({"type": "message", "message": {
            "role": "assistant", "stopReason": "toolUse",
            "content": [
                {"type": "thinking", "thinking": "plan"},
                {"type": "text", "text": "checking"},
                {"type": "toolCall", "name": "bash", "arguments": {"command": "pwd"}}
            ]
        }}));
        assert_eq!(pi_status(&record), Some(SessionStatus::Running));
        assert_eq!(pi_turn_event(&record), None);
        assert_eq!(
            parse_pi_record(&record),
            [
                LogEntry::new(None, EntryKind::Thinking, "plan"),
                LogEntry::new(None, EntryKind::Assistant, "checking"),
                LogEntry::titled(None, EntryKind::Tool, "bash", r#"{"command":"pwd"}"#),
            ]
        );
        let result = object(json!({"type": "message", "message": {
            "role": "toolResult", "toolName": "bash", "isError": true,
            "content": [{"type": "text", "text": "\u{1b}[31mfailed\u{1b}[0m"}, {"type": "image", "data": "ignored"}]
        }}));
        assert_eq!(pi_turn_event(&result), None);
        assert_eq!(
            parse_pi_record(&result),
            [LogEntry::titled(None, EntryKind::Error, "bash", "failed"),]
        );
    }

    #[test]
    fn infers_status_without_treating_metadata_as_activity() {
        for stop in ["stop", "error", "aborted"] {
            let record = object(json!({
                "type": "message", "timestamp": 5000, "message": {
                    "role": "assistant", "timestamp": 2000, "stopReason": stop,
                    "content": [], "errorMessage": "stopped"
                }
            }));
            assert_eq!(pi_status(&record), Some(SessionStatus::Idle));
            assert_eq!(
                pi_turn_event(&record),
                Some(TurnEvent::Finish(Some(5000.0)))
            );
            assert_eq!(parse_pi_record(&record)[0].kind, EntryKind::Error);
        }
        let user = object(json!({"type": "message", "message": {
            "role": "user", "timestamp": 1000, "content": "hi"
        }}));
        assert_eq!(pi_status(&user), Some(SessionStatus::Running));
        assert_eq!(pi_turn_event(&user), Some(TurnEvent::Start(Some(1000.0))));
        let assistant = object(json!({"type": "message", "message": {
            "role": "assistant", "timestamp": 2000, "stopReason": "stop"
        }}));
        assert_eq!(pi_turn_event(&assistant), Some(TurnEvent::Finish(None)));
        let custom = object(json!({"type": "custom", "data": {"secret": "ignored"}}));
        assert_eq!(pi_status(&custom), None);
        assert_eq!(pi_turn_event(&custom), None);
        assert!(parse_pi_record(&custom).is_empty());
    }

    #[test]
    fn parses_user_compaction_and_bash_messages() {
        let user = object(
            json!({"type": "message", "timestamp": "2026-01-01T00:00:00Z",
            "message": {"role": "user", "content": "hello"}}),
        );
        assert_eq!(
            parse_pi_record(&user),
            [LogEntry::new(
                user.time("timestamp"),
                EntryKind::User,
                "hello"
            )]
        );
        let compact = object(json!({"type": "compaction", "summary": "summary"}));
        assert_eq!(
            parse_pi_record(&compact),
            [LogEntry::titled(
                None,
                EntryKind::Status,
                "context compacted",
                "summary"
            )]
        );
        let bash = object(json!({"type": "message", "message": {
            "role": "bashExecution", "command": "false", "output": "failed", "exitCode": 1
        }}));
        assert_eq!(
            parse_pi_record(&bash),
            [
                LogEntry::titled(None, EntryKind::Tool, "bash", "false"),
                LogEntry::new(None, EntryKind::Error, "failed"),
            ]
        );
    }
}
