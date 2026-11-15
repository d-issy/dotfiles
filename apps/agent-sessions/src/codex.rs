use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;

use crate::files::{LogSummary, SummaryTracker, list_dir, mtime, read_first_record};
use crate::json::{
    arr_of, js_entries, js_num, js_stringify, obj_of, parse_json_line, parse_time, str_of,
    truthy_str,
};
use crate::text::{js_trim_end, last_summary, one_line, sanitize};
use crate::types::{Agent, EntryKind, JsonObject, LogEntry, Session, SessionStatus};

fn text_blocks(content: Option<&Value>) -> String {
    if let Some(Value::String(text)) = content {
        return text.clone();
    }
    arr_of(content)
        .iter()
        .filter_map(|block| truthy_str(obj_of(Some(block)).get("text")))
        .collect()
}

/// Matches `^-\w*c$`.
fn is_shell_flag(text: &str) -> bool {
    text.strip_prefix('-')
        .and_then(|rest| rest.strip_suffix('c'))
        .is_some_and(|middle| {
            middle
                .chars()
                .all(|char| char.is_ascii_alphanumeric() || char == '_')
        })
}

fn command_text(command: Option<&Value>) -> String {
    let parts: Vec<&str> = arr_of(command).iter().filter_map(Value::as_str).collect();
    // Unwrap `zsh -lc '<script>'` style invocations.
    if parts.len() == 3 && is_shell_flag(parts[1]) {
        return parts[2].to_string();
    }
    parts.join(" ")
}

fn last_lines(text: &str, count: usize) -> String {
    let lines: Vec<&str> = js_trim_end(text).split('\n').collect();
    lines[lines.len().saturating_sub(count)..].join("\n")
}

fn status_kind(item: &JsonObject, otherwise: EntryKind) -> EntryKind {
    if str_of(item.get("status")) == Some("failed") {
        EntryKind::Error
    } else {
        otherwise
    }
}

fn parse_item(item: &JsonObject, time: Option<f64>) -> Vec<LogEntry> {
    match str_of(item.get("type")) {
        Some("UserMessage") => vec![LogEntry::new(
            time,
            EntryKind::User,
            sanitize(&text_blocks(item.get("content"))),
        )],
        Some("AgentMessage") => vec![LogEntry::new(
            time,
            EntryKind::Assistant,
            sanitize(&text_blocks(item.get("content"))),
        )],
        Some("Reasoning") => {
            let summary = arr_of(item.get("summary_text"))
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>()
                .join("\n");
            if summary.is_empty() {
                Vec::new()
            } else {
                vec![LogEntry::new(time, EntryKind::Thinking, sanitize(&summary))]
            }
        }
        Some("CommandExecution") => {
            let mut entries = vec![LogEntry::titled(
                time,
                EntryKind::Tool,
                "exec",
                sanitize(&format!("$ {}", command_text(item.get("command")))),
            )];
            let exit_code = item.get("exit_code").and_then(Value::as_f64);
            let output = last_lines(str_of(item.get("aggregated_output")).unwrap_or(""), 20);
            let failed = exit_code.is_some_and(|code| code != 0.0);
            if !output.is_empty() || failed {
                let text = match exit_code {
                    Some(code) if failed => [format!("exit {}", js_num(code)), output]
                        .into_iter()
                        .filter(|part| !part.is_empty())
                        .collect::<Vec<_>>()
                        .join("\n"),
                    _ => output,
                };
                entries.push(LogEntry::new(
                    time,
                    if failed {
                        EntryKind::Error
                    } else {
                        EntryKind::Result
                    },
                    sanitize(&text),
                ));
            }
            entries
        }
        Some("FileChange") => {
            let changes: Vec<String> = js_entries(obj_of(item.get("changes")))
                .into_iter()
                .map(|(path, change)| {
                    let kind = str_of(obj_of(Some(change)).get("type")).unwrap_or("change");
                    format!("{kind} {path}")
                })
                .collect();
            vec![LogEntry::titled(
                time,
                status_kind(item, EntryKind::Tool),
                "edit",
                sanitize(&changes.join("\n")),
            )]
        }
        Some("McpToolCall") => {
            let arguments = match item.get("arguments") {
                None | Some(Value::Null) => "{}".to_string(),
                Some(value) => js_stringify(value),
            };
            vec![LogEntry::titled(
                time,
                status_kind(item, EntryKind::Tool),
                sanitize(&format!(
                    "{}.{}",
                    str_of(item.get("server")).unwrap_or("mcp"),
                    str_of(item.get("tool")).unwrap_or("")
                )),
                sanitize(&arguments),
            )]
        }
        Some("Extension") => vec![LogEntry::titled(
            time,
            EntryKind::Tool,
            sanitize(str_of(item.get("kind")).unwrap_or("extension")),
            sanitize(str_of(item.get("query")).unwrap_or("")),
        )],
        Some("SubAgentActivity") => vec![LogEntry::new(
            time,
            EntryKind::Status,
            sanitize(&format!(
                "subagent {} {}",
                str_of(item.get("kind")).unwrap_or(""),
                str_of(item.get("agent_path")).unwrap_or("")
            )),
        )],
        _ => Vec::new(),
    }
}

/// Convert one Codex rollout record into log entries.
pub fn parse_codex_record(record: &JsonObject) -> Vec<LogEntry> {
    let time = parse_time(record.get("timestamp"));
    match str_of(record.get("type")) {
        Some("compacted") => {
            return vec![LogEntry::new(time, EntryKind::Status, "context compacted")];
        }
        Some("event_msg") => {}
        _ => return Vec::new(),
    }
    let payload = obj_of(record.get("payload"));
    match str_of(payload.get("type")) {
        Some("item_completed") => parse_item(obj_of(payload.get("item")), time),
        Some("task_started") => vec![LogEntry::new(time, EntryKind::Status, "turn started")],
        Some("task_complete") => vec![LogEntry::new(time, EntryKind::Status, "turn complete")],
        Some("turn_aborted") => vec![LogEntry::new(
            time,
            EntryKind::Status,
            format!(
                "turn aborted ({})",
                str_of(payload.get("reason")).unwrap_or("unknown")
            ),
        )],
        Some("error" | "stream_error") => vec![LogEntry::new(
            time,
            EntryKind::Error,
            sanitize(str_of(payload.get("message")).unwrap_or("error")),
        )],
        _ => Vec::new(),
    }
}

pub fn codex_model(records: &[JsonObject]) -> Option<String> {
    records.iter().rev().find_map(|record| {
        let payload = obj_of(record.get("payload"));
        let kind = str_of(record.get("type"));
        if kind == Some("turn_context")
            && let Some(model) = truthy_str(payload.get("model"))
        {
            return Some(model.to_string());
        }
        if kind == Some("event_msg")
            && str_of(payload.get("type")) == Some("thread_settings_applied")
        {
            return truthy_str(obj_of(payload.get("thread_settings")).get("model"))
                .map(str::to_string);
        }
        None
    })
}

/// Derive the turn state from the latest task lifecycle event.
pub fn codex_status(records: &[JsonObject]) -> Option<SessionStatus> {
    records.iter().rev().find_map(|record| {
        if str_of(record.get("type")) != Some("event_msg") {
            return None;
        }
        match str_of(obj_of(record.get("payload")).get("type")) {
            Some("task_started") => Some(SessionStatus::Running),
            Some("task_complete" | "turn_aborted") => Some(SessionStatus::Idle),
            _ => None,
        }
    })
}

fn thread_names(home: &Path) -> HashMap<String, String> {
    let mut names = HashMap::new();
    let Ok(bytes) = fs::read(home.join("session_index.jsonl")) else {
        return names;
    };
    for line in String::from_utf8_lossy(&bytes).split('\n') {
        let Some(record) = parse_json_line(line) else {
            continue;
        };
        if let (Some(id), Some(name)) = (
            truthy_str(record.get("id")),
            truthy_str(record.get("thread_name")),
        ) {
            names.insert(id.to_string(), name.to_string());
        }
    }
    names
}

/// All rollout files; resumed sessions keep writing to their original day.
fn rollout_paths(root: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for year in list_dir(root) {
        for month in list_dir(&root.join(&year)) {
            for day in list_dir(&root.join(&year).join(&month)) {
                let dir = root.join(&year).join(&month).join(&day);
                for name in list_dir(&dir) {
                    if name.starts_with("rollout-") && name.ends_with(".jsonl") {
                        paths.push(dir.join(name));
                    }
                }
            }
        }
    }
    paths
}

fn reduce(summary: &mut LogSummary, record: &JsonObject) {
    let records = std::slice::from_ref(record);
    if let Some(status) = codex_status(records) {
        summary.status = Some(status);
    }
    if let Some(model) = codex_model(records) {
        summary.model = Some(model);
    }
    if let Some(last) = last_summary(&parse_codex_record(record)) {
        summary.last = Some(last);
    }
}

fn is_guardian(meta: &JsonObject) -> bool {
    str_of(meta.get("thread_source")) == Some("guardian_review")
        || str_of(obj_of(obj_of(meta.get("source")).get("subagent")).get("other"))
            == Some("guardian")
}

pub struct CodexDiscovery {
    tracker: SummaryTracker,
    // session_meta is written once at the top of a rollout, so cache it per path.
    // Only successful reads are cached: the first line may still be mid-write.
    meta_cache: HashMap<PathBuf, JsonObject>,
}

impl CodexDiscovery {
    pub fn new() -> Self {
        Self {
            tracker: SummaryTracker::new(reduce),
            meta_cache: HashMap::new(),
        }
    }

    fn session_meta(&mut self, path: &Path) -> Option<JsonObject> {
        if let Some(cached) = self.meta_cache.get(path) {
            return Some(cached.clone());
        }
        let first = read_first_record(path)?;
        if str_of(first.get("type")) != Some("session_meta") {
            return None;
        }
        let meta = obj_of(first.get("payload")).clone();
        self.meta_cache.insert(path.to_path_buf(), meta.clone());
        Some(meta)
    }

    /// Discover Codex sessions whose rollout was written within the window.
    pub fn discover(&mut self, home: &Path, now: f64, window_ms: f64) -> Vec<Session> {
        let since = now - window_ms;
        let names = thread_names(home);
        let mut sessions = Vec::new();
        for path in rollout_paths(&home.join("sessions")) {
            let Some(updated_at) = mtime(&path) else {
                continue;
            };
            if updated_at < since {
                continue;
            }
            let Some(meta) = self.session_meta(&path) else {
                continue;
            };
            if is_guardian(&meta) {
                continue;
            }
            let Some(id) = truthy_str(meta.get("id")).map(str::to_string) else {
                continue;
            };
            let summary = self.tracker.summarize(&path);
            let nickname = truthy_str(meta.get("agent_nickname"));
            let agent_path = truthy_str(meta.get("agent_path"));
            let title = match (names.get(&id), nickname) {
                (Some(name), _) => name.clone(),
                (None, Some(nickname)) => match agent_path {
                    Some(agent_path) => format!("{nickname} ({agent_path})"),
                    None => nickname.to_string(),
                },
                (None, None) => id.clone(),
            };
            sessions.push(Session {
                key: format!("codex:{id}"),
                agent: Agent::Codex,
                title: one_line(&title),
                cwd: str_of(meta.get("cwd")).unwrap_or("").to_string(),
                status: summary.status.unwrap_or(SessionStatus::Unknown),
                updated_at,
                started_at: parse_time(meta.get("timestamp")),
                log_path: path.to_string_lossy().into_owned(),
                parent_key: truthy_str(meta.get("parent_thread_id"))
                    .map(|parent| format!("codex:{parent}")),
                model: summary.model,
                last: summary.last,
                id,
            });
        }
        self.tracker.prune();
        sessions
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::files::tests::{TempDir, append};
    use crate::render::render_entries;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    const TIMESTAMP: &str = "2026-11-15T13:13:06.042Z";

    fn time() -> Option<f64> {
        crate::json::date_parse(TIMESTAMP)
    }

    fn record(value: Value) -> JsonObject {
        value.as_object().unwrap().clone()
    }

    fn event(payload: Value) -> JsonObject {
        record(json!({"type": "event_msg", "timestamp": TIMESTAMP, "payload": payload}))
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
    fn derives_the_turn_status_from_lifecycle_events() {
        assert_eq!(
            codex_status(&[event(json!({"type": "task_started"}))]),
            Some(SessionStatus::Running)
        );
        assert_eq!(
            codex_status(&[
                event(json!({"type": "task_started"})),
                event(json!({"type": "token_count"})),
                event(json!({"type": "task_complete"})),
            ]),
            Some(SessionStatus::Idle)
        );
        assert_eq!(codex_status(&[]), None);
    }

    #[test]
    fn uses_the_latest_codex_turn_context_or_thread_settings() {
        assert_eq!(
            codex_model(&[
                event(json!({
                    "type": "thread_settings_applied",
                    "thread_settings": {"model": "gpt-6.1-sol"},
                })),
                record(json!({"type": "turn_context", "payload": {"model": "gpt-6.1-luna"}})),
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

    fn line(value: Value) -> String {
        format!("{value}\n")
    }

    fn event_line(kind: &str) -> String {
        line(json!({"type": "event_msg", "payload": {"type": kind}}))
    }

    fn noise(bytes: usize) -> String {
        line(
            json!({"type": "event_msg", "payload": {"type": "token_count", "pad": "x".repeat(bytes)}}),
        )
    }

    fn now() -> f64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as f64
    }

    struct Fixture {
        home: TempDir,
        rollout: PathBuf,
        discovery: CodexDiscovery,
    }

    impl Fixture {
        fn new() -> Self {
            let home = TempDir::new();
            // A resumed session keeps writing to its original (old) day directory.
            let dir = home.0.join("sessions/2025/01/02");
            fs::create_dir_all(&dir).unwrap();
            let rollout = dir.join("rollout-2025-01-02T00-00-00-abc.jsonl");
            fs::write(
                &rollout,
                line(json!({
                    "type": "session_meta",
                    "payload": {"id": "abc", "cwd": "/w/p", "timestamp": "2025-01-02T00:00:00Z"},
                })) + &line(json!({"type": "turn_context", "payload": {"model": "gpt-a"}}))
                    + &event_line("task_started"),
            )
            .unwrap();
            Self {
                home,
                rollout,
                discovery: CodexDiscovery::new(),
            }
        }

        fn sessions(&mut self) -> Vec<Session> {
            self.discovery.discover(&self.home.0, now(), 3_600_000.0)
        }

        fn find(&mut self) -> Option<Session> {
            self.sessions()
                .into_iter()
                .find(|session| session.id == "abc")
        }

        fn ids(&mut self) -> Vec<String> {
            self.sessions()
                .into_iter()
                .map(|session| session.id)
                .collect()
        }
    }

    #[test]
    fn finds_resumed_sessions_stored_in_old_date_directories() {
        let session = Fixture::new().find().unwrap();
        assert_eq!(session.status, SessionStatus::Running);
        assert_eq!(session.model.as_deref(), Some("gpt-a"));
    }

    #[test]
    fn retries_a_rollout_whose_first_line_was_still_being_written() {
        let mut fixture = Fixture::new();
        let dir = fixture.home.0.join("sessions/2025/01/03");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("rollout-2025-01-03T00-00-00-new.jsonl");
        let meta = line(json!({"type": "session_meta", "payload": {"id": "new", "cwd": "/w/p"}}));
        fs::write(&path, &meta.as_bytes()[..20]).unwrap();
        assert!(!fixture.ids().contains(&"new".to_string()));
        append(&path, &meta.as_bytes()[20..]);
        assert!(fixture.ids().contains(&"new".to_string()));
    }

    #[test]
    fn keeps_status_and_model_current_across_large_output_bursts() {
        let mut fixture = Fixture::new();
        assert_eq!(fixture.find().unwrap().status, SessionStatus::Running);
        append(
            &fixture.rollout,
            (event_line("task_complete") + &noise(300 * 1024)).as_bytes(),
        );
        assert_eq!(fixture.find().unwrap().status, SessionStatus::Idle);
        append(
            &fixture.rollout,
            (line(json!({"type": "turn_context", "payload": {"model": "gpt-b"}}))
                + &event_line("task_started")
                + &noise(300 * 1024))
                .as_bytes(),
        );
        let session = fixture.find().unwrap();
        assert_eq!(session.status, SessionStatus::Running);
        assert_eq!(session.model.as_deref(), Some("gpt-b"));
    }

    #[test]
    fn renders_appended_entries_exactly_as_a_full_re_render() {
        let entries = [
            LogEntry::new(None, EntryKind::User, "first"),
            LogEntry::new(None, EntryKind::Assistant, "answer"),
            LogEntry::new(None, EntryKind::User, "second"),
            LogEntry::titled(None, EntryKind::Tool, "Bash", "$ ls"),
        ];
        let (head, tail) = entries.split_at(2);
        let mut appended = render_entries(head, 80, false);
        appended.extend(render_entries(tail, 80, true));
        assert_eq!(appended, render_entries(&entries, 80, false));
    }
}
