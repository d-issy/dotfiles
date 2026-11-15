use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use rustix::io::Errno;
use rustix::process::{Pid, test_kill_process};
use serde_json::Value;

use crate::files::{LogSummary, SummaryTracker, list_dir, mtime, read_first_record};
use crate::json::{arr_of, js_stringify, obj_of, parse_json_line, parse_time, str_of, truthy_str};
use crate::text::{last_summary, one_line, sanitize};
use crate::types::{Agent, EntryKind, JsonObject, LogEntry, Session, SessionStatus};

fn content_text(content: Option<&Value>) -> String {
    if let Some(Value::String(text)) = content {
        return text.clone();
    }
    arr_of(content)
        .iter()
        .filter_map(|block| truthy_str(obj_of(Some(block)).get("text")))
        .collect::<Vec<_>>()
        .join("\n")
}

const INPUT_KEYS: [&str; 10] = [
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
    let fields = obj_of(input);
    let mut parts = Vec::new();
    for key in INPUT_KEYS {
        let Some(value) = truthy_str(fields.get(key)) else {
            continue;
        };
        parts.push(if key == "command" {
            format!("$ {value}")
        } else {
            value.to_string()
        });
        if parts.len() == 2 {
            break;
        }
    }
    if !parts.is_empty() {
        return parts.join("\n");
    }
    match input {
        None => String::new(),
        Some(value) => {
            let json = js_stringify(value);
            if json == "{}" { String::new() } else { json }
        }
    }
}

/// Convert one Claude Code transcript record into log entries.
pub fn parse_claude_record(record: &JsonObject) -> Vec<LogEntry> {
    let time = parse_time(record.get("timestamp"));
    let item_type = |item: &JsonObject| str_of(item.get("type")).map(str::to_string);
    match str_of(record.get("type")) {
        Some("user") => {
            if record.get("isMeta") == Some(&Value::Bool(true)) {
                return Vec::new();
            }
            let content = obj_of(record.get("message")).get("content");
            if let Some(Value::String(text)) = content {
                return vec![LogEntry::new(time, EntryKind::User, sanitize(text))];
            }
            let mut entries = Vec::new();
            for block in arr_of(content) {
                let item = obj_of(Some(block));
                match item_type(item).as_deref() {
                    Some("text") => entries.push(LogEntry::new(
                        time,
                        EntryKind::User,
                        sanitize(str_of(item.get("text")).unwrap_or("")),
                    )),
                    Some("tool_result") => entries.push(LogEntry::new(
                        time,
                        if item.get("is_error") == Some(&Value::Bool(true)) {
                            EntryKind::Error
                        } else {
                            EntryKind::Result
                        },
                        sanitize(&content_text(item.get("content"))),
                    )),
                    _ => {}
                }
            }
            entries
        }
        Some("assistant") => {
            let mut entries = Vec::new();
            for block in arr_of(obj_of(record.get("message")).get("content")) {
                let item = obj_of(Some(block));
                match item_type(item).as_deref() {
                    Some("text") => entries.push(LogEntry::new(
                        time,
                        EntryKind::Assistant,
                        sanitize(str_of(item.get("text")).unwrap_or("")),
                    )),
                    Some("thinking") => {
                        if let Some(thinking) = truthy_str(item.get("thinking")) {
                            entries.push(LogEntry::new(
                                time,
                                EntryKind::Thinking,
                                sanitize(thinking),
                            ));
                        }
                    }
                    Some("tool_use") => entries.push(LogEntry::titled(
                        time,
                        EntryKind::Tool,
                        sanitize(str_of(item.get("name")).unwrap_or("tool")),
                        sanitize(&summarize_tool_input(item.get("input"))),
                    )),
                    _ => {}
                }
            }
            entries
        }
        Some("system") => match str_of(record.get("subtype")) {
            Some("compact_boundary") => {
                vec![LogEntry::new(time, EntryKind::Status, "context compacted")]
            }
            Some("api_error") => {
                vec![LogEntry::new(
                    time,
                    EntryKind::Error,
                    "API error (retrying)",
                )]
            }
            _ => Vec::new(),
        },
        _ => Vec::new(),
    }
}

pub fn claude_title(records: &[JsonObject]) -> Option<String> {
    records.iter().rev().find_map(|record| {
        let kind = str_of(record.get("type"));
        if kind != Some("ai-title") && kind != Some("custom-title") {
            return None;
        }
        let title = str_of(record.get("customTitle")).or(str_of(record.get("aiTitle")));
        title.filter(|title| !title.is_empty()).map(one_line)
    })
}

pub fn claude_model(records: &[JsonObject]) -> Option<String> {
    records.iter().rev().find_map(|record| {
        if str_of(record.get("type")) != Some("assistant") {
            return None;
        }
        truthy_str(obj_of(record.get("message")).get("model"))
            .filter(|model| *model != "<synthetic>")
            .map(str::to_string)
    })
}

pub fn claude_status(status: Option<&Value>) -> SessionStatus {
    match str_of(status) {
        Some("busy" | "shell") => SessionStatus::Running,
        Some("idle") => SessionStatus::Idle,
        Some("waiting" | "needs_input" | "needs-input" | "blocked") => SessionStatus::Waiting,
        _ => SessionStatus::Unknown,
    }
}

/// Derive a transcript's turn state from its latest turn record. Subagents
/// have no registry entry, and teammates never get `finished` in their meta
/// file, so an assistant message that ends the turn is the only idle signal.
/// User records (prompts, tool results, teammate messages) start or continue
/// a turn; attachments and API bookkeeping records do not change the state.
pub fn claude_turn_status(records: &[JsonObject]) -> Option<SessionStatus> {
    records
        .iter()
        .rev()
        .find_map(|record| match str_of(record.get("type")) {
            Some("user") => Some(SessionStatus::Running),
            Some("assistant") => match str_of(obj_of(record.get("message")).get("stop_reason"))? {
                "end_turn" | "stop_sequence" | "refusal" => Some(SessionStatus::Idle),
                _ => Some(SessionStatus::Running),
            },
            _ => None,
        })
}

/// Read a process start time from /proc (Linux only).
pub fn proc_start_time(stat: &str) -> Option<String> {
    // Fields after the parenthesized command; starttime is field 22 overall.
    let after = stat.rfind(')').map_or(stat, |index| &stat[index + 1..]);
    let mut chars = after.chars();
    chars.next();
    chars.as_str().split(' ').nth(19).map(str::to_string)
}

fn is_alive(entry: &JsonObject) -> bool {
    let Some(pid) = entry.get("pid").and_then(Value::as_f64) else {
        return false;
    };
    if pid <= 0.0 {
        return false;
    }
    // `process.kill` rejects anything but a 32-bit integer pid.
    if pid.fract() != 0.0 || pid > f64::from(i32::MAX) {
        return false;
    }
    let pid = pid as i32;
    let Some(target) = Pid::from_raw(pid) else {
        return false;
    };
    if let Err(error) = test_kill_process(target)
        && error != Errno::PERM
    {
        return false;
    }
    // Guard against PID reuse when the registry records the start time.
    let Some(expected) = str_of(entry.get("procStart")) else {
        return true;
    };
    match fs::read(format!("/proc/{pid}/stat")) {
        Ok(bytes) => proc_start_time(&String::from_utf8_lossy(&bytes)).as_deref() == Some(expected),
        Err(_) => true,
    }
}

pub fn encode_project_dir(cwd: &str) -> String {
    cwd.chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() {
                char
            } else {
                '-'
            }
        })
        .collect()
}

fn find_transcript(home: &Path, cwd: &str, id: &str) -> Option<PathBuf> {
    let projects = home.join("projects");
    let direct = projects
        .join(encode_project_dir(cwd))
        .join(format!("{id}.jsonl"));
    if mtime(&direct).is_some() {
        return Some(direct);
    }
    list_dir(&projects)
        .into_iter()
        .map(|dir| projects.join(dir).join(format!("{id}.jsonl")))
        .find(|candidate| mtime(candidate).is_some())
}

fn read_json(path: &Path) -> Option<JsonObject> {
    let bytes = fs::read(path).ok()?;
    parse_json_line(&String::from_utf8_lossy(&bytes))
}

fn strip_jsonl(path: &str) -> &str {
    path.strip_suffix(".jsonl").unwrap_or(path)
}

/// Finished subagents stay listed briefly so their final output is visible.
const FINISHED_SUBAGENT_MS: f64 = 10.0 * 60_000.0;

fn reduce(summary: &mut LogSummary, record: &JsonObject) {
    let records = std::slice::from_ref(record);
    if let Some(title) = claude_title(records) {
        summary.title = Some(title);
    }
    if let Some(model) = claude_model(records) {
        summary.model = Some(model);
    }
    if let Some(last) = last_summary(&parse_claude_record(record)) {
        summary.last = Some(last);
    }
    if let Some(status) = claude_turn_status(records) {
        summary.status = Some(status);
    }
}

pub struct ClaudeDiscovery {
    tracker: SummaryTracker,
    start_cache: HashMap<PathBuf, f64>,
}

impl ClaudeDiscovery {
    pub fn new() -> Self {
        Self {
            tracker: SummaryTracker::new(reduce),
            start_cache: HashMap::new(),
        }
    }

    /// Subagent transcripts start with the prompt, so its timestamp is the start.
    /// Only successful reads are cached: the first line may still be mid-write.
    fn first_timestamp(&mut self, path: &Path) -> Option<f64> {
        if let Some(cached) = self.start_cache.get(path) {
            return Some(*cached);
        }
        let time = parse_time(read_first_record(path)?.get("timestamp"))?;
        self.start_cache.insert(path.to_path_buf(), time);
        Some(time)
    }

    fn subagent_sessions(&mut self, transcript: &Path, parent: &Session, now: f64) -> Vec<Session> {
        let transcript = transcript.to_string_lossy();
        let dir = Path::new(strip_jsonl(&transcript)).join("subagents");
        let mut sessions = Vec::new();
        for name in list_dir(&dir) {
            if !name.ends_with(".jsonl") {
                continue;
            }
            let path = dir.join(&name);
            let updated_at = mtime(&path).unwrap_or(0.0);
            let path_text = path.to_string_lossy().into_owned();
            let meta = read_json(Path::new(&format!("{}.meta.json", strip_jsonl(&path_text))))
                .unwrap_or_default();
            let finished = meta.get("finished") == Some(&Value::Bool(true));
            if finished && now - updated_at > FINISHED_SUBAGENT_MS {
                continue;
            }
            let id = strip_jsonl(&name).to_string();
            let description = str_of(meta.get("description")).unwrap_or(&id);
            let title = match truthy_str(meta.get("agentType")) {
                Some(kind) => one_line(&format!("{kind}: {description}")),
                None => one_line(description),
            };
            let summary = self.tracker.summarize(&path);
            sessions.push(Session {
                key: format!("claude:{}:{id}", parent.id),
                agent: Agent::Claude,
                title,
                cwd: parent.cwd.clone(),
                status: if finished {
                    SessionStatus::Ended
                } else {
                    summary.status.unwrap_or(SessionStatus::Running)
                },
                updated_at,
                started_at: self.first_timestamp(&path),
                log_path: path_text,
                parent_key: Some(parent.key.clone()),
                model: summary.model,
                last: summary.last,
                id,
            });
        }
        sessions
    }

    /// Discover live Claude Code sessions from the session registry.
    pub fn discover(&mut self, home: &Path, now: f64) -> Vec<Session> {
        let registry = home.join("sessions");
        let mut sessions = Vec::new();
        for name in list_dir(&registry) {
            if !name.ends_with(".json") {
                continue;
            }
            let Some(entry) = read_json(&registry.join(&name)) else {
                continue;
            };
            if !is_alive(&entry) {
                continue;
            }
            let Some(id) = truthy_str(entry.get("sessionId")).map(str::to_string) else {
                continue;
            };
            let cwd = str_of(entry.get("cwd")).unwrap_or("").to_string();
            let log_path = find_transcript(home, &cwd, &id);
            let summary = log_path
                .as_deref()
                .map(|path| self.tracker.summarize(path))
                .unwrap_or_default();
            let session = Session {
                key: format!("claude:{id}"),
                agent: Agent::Claude,
                title: summary
                    .title
                    .unwrap_or_else(|| one_line(str_of(entry.get("name")).unwrap_or(&id))),
                cwd,
                status: claude_status(entry.get("status")),
                started_at: parse_time(entry.get("startedAt")),
                updated_at: log_path
                    .as_deref()
                    .and_then(mtime)
                    .or_else(|| parse_time(entry.get("updatedAt")))
                    .unwrap_or(0.0),
                log_path: log_path
                    .as_deref()
                    .map(|path| path.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                parent_key: None,
                model: summary.model,
                last: summary.last,
                id,
            };
            let children = match &log_path {
                Some(path) => self.subagent_sessions(path, &session, now),
                None => Vec::new(),
            };
            sessions.push(session);
            sessions.extend(children);
        }
        self.tracker.prune();
        sessions
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const TIMESTAMP: &str = "2026-11-15T13:13:06.042Z";

    fn time() -> Option<f64> {
        crate::json::date_parse(TIMESTAMP)
    }

    fn record(value: Value) -> JsonObject {
        value.as_object().unwrap().clone()
    }

    #[test]
    fn parses_user_prompts_and_skips_meta_messages() {
        assert_eq!(
            parse_claude_record(&record(json!({
                "type": "user",
                "timestamp": TIMESTAMP,
                "message": {"role": "user", "content": "hello\u{1b}[31m"},
            }))),
            [LogEntry::new(time(), EntryKind::User, "hello")]
        );
        assert_eq!(
            parse_claude_record(&record(json!({
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
            parse_claude_record(&record(json!({
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
            parse_claude_record(&record(json!({
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
            parse_claude_record(&record(json!({"type": "attachment"}))),
            []
        );
        assert_eq!(
            parse_claude_record(&record(json!({"type": "api-request-blob"}))),
            []
        );
    }

    #[test]
    fn uses_the_latest_title() {
        assert_eq!(
            claude_title(&[
                record(json!({"type": "ai-title", "aiTitle": "old"})),
                record(json!({"type": "ai-title", "aiTitle": "new"})),
            ])
            .as_deref(),
            Some("new")
        );
    }

    #[test]
    fn maps_registry_status() {
        assert_eq!(claude_status(Some(&json!("busy"))), SessionStatus::Running);
        assert_eq!(claude_status(Some(&json!("shell"))), SessionStatus::Running);
        assert_eq!(claude_status(Some(&json!("idle"))), SessionStatus::Idle);
        assert_eq!(claude_status(Some(&json!("other"))), SessionStatus::Unknown);
    }

    #[test]
    fn encodes_project_directories_like_claude_code() {
        assert_eq!(
            encode_project_dir("/home/u/code/github.com/a/b.c"),
            "-home-u-code-github-com-a-b-c"
        );
    }

    #[test]
    fn reads_the_process_start_time_even_when_the_command_has_spaces() {
        let fields: Vec<String> = (0..30).map(|index| (index + 3).to_string()).collect();
        assert_eq!(
            proc_start_time(&format!("123 (a b) {}", fields.join(" "))).as_deref(),
            Some("22")
        );
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
                record(json!({"type": "assistant", "message": {"model": "claude-fable-5-2"}})),
                record(json!({"type": "assistant", "message": {"model": "claude-opus-5-5"}})),
                record(json!({"type": "assistant", "message": {"model": "<synthetic>"}})),
                record(json!({"type": "user", "message": {"content": "hi"}})),
            ])
            .as_deref(),
            Some("claude-opus-5-5")
        );
        assert_eq!(claude_model(&[]), None);
    }

    fn turn(kind: &str, stop_reason: Option<&str>) -> JsonObject {
        match kind {
            "assistant" => record(json!({
                "type": "assistant",
                "isSidechain": true,
                "message": {"role": "assistant", "stop_reason": stop_reason, "content": [{"type": "text", "text": "x"}]},
            })),
            "user" => record(json!({
                "type": "user",
                "isSidechain": true,
                "message": {"role": "user", "content": [{"type": "tool_result", "content": "x"}]},
            })),
            other => record(json!({"type": other, "isSidechain": true})),
        }
    }

    #[test]
    fn derives_the_turn_status_from_the_latest_turn_record() {
        // A finished turn followed by hook attachments is idle.
        assert_eq!(
            claude_turn_status(&[
                turn("user", None),
                turn("assistant", Some("end_turn")),
                turn("attachment", None),
                turn("attachment", None),
            ]),
            Some(SessionStatus::Idle)
        );
        // A tool call or a pending tool result keeps the turn running.
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
        // A new message after an idle turn starts the next turn.
        assert_eq!(
            claude_turn_status(&[turn("assistant", Some("end_turn")), turn("user", None)]),
            Some(SessionStatus::Running)
        );
        assert_eq!(claude_turn_status(&[turn("attachment", None)]), None);
    }

    fn lines(records: &[JsonObject]) -> String {
        records
            .iter()
            .map(|record| format!("{}\n", Value::Object(record.clone())))
            .collect()
    }

    #[test]
    fn shows_idle_subagents_as_idle() {
        let home = crate::files::tests::TempDir::new();
        let pid = std::process::id();
        fs::create_dir_all(home.0.join("sessions")).unwrap();
        fs::write(
            home.0.join("sessions/1.json"),
            json!({"pid": pid, "sessionId": "main", "cwd": "/w/p", "status": "busy"}).to_string(),
        )
        .unwrap();
        let project = home.0.join("projects/-w-p");
        let subagents = project.join("main/subagents");
        fs::create_dir_all(&subagents).unwrap();
        // The main transcript's own last turn ended, but the registry says busy.
        fs::write(
            project.join("main.jsonl"),
            lines(&[turn("user", None), turn("assistant", Some("end_turn"))]),
        )
        .unwrap();
        let agents: [(&str, Vec<JsonObject>, Value); 4] = [
            (
                "agent-idle",
                vec![
                    turn("user", None),
                    turn("assistant", Some("end_turn")),
                    turn("attachment", None),
                ],
                json!({"agentType": "teammate", "description": "idle"}),
            ),
            (
                "agent-working",
                vec![
                    turn("assistant", Some("tool_use")),
                    turn("user", None),
                    turn("api-request", None),
                ],
                json!({"agentType": "teammate", "description": "working"}),
            ),
            (
                "agent-resumed",
                vec![
                    turn("assistant", Some("end_turn")),
                    turn("attachment", None),
                    turn("user", None),
                ],
                json!({"agentType": "teammate", "description": "resumed"}),
            ),
            (
                "agent-finished",
                vec![turn("user", None), turn("assistant", Some("end_turn"))],
                json!({"description": "finished", "finished": true}),
            ),
        ];
        for (name, records, meta) in &agents {
            fs::write(subagents.join(format!("{name}.jsonl")), lines(records)).unwrap();
            fs::write(
                subagents.join(format!("{name}.meta.json")),
                meta.to_string(),
            )
            .unwrap();
        }
        let now = crate::sessions::now_ms();
        let mut discovery = ClaudeDiscovery::new();
        let status = |sessions: &[Session], id: &str| {
            sessions
                .iter()
                .find(|session| session.id == id)
                .map(|session| session.status)
        };
        let sessions = discovery.discover(&home.0, now);
        assert_eq!(status(&sessions, "main"), Some(SessionStatus::Running));
        assert_eq!(status(&sessions, "agent-idle"), Some(SessionStatus::Idle));
        assert_eq!(
            status(&sessions, "agent-working"),
            Some(SessionStatus::Running)
        );
        assert_eq!(
            status(&sessions, "agent-resumed"),
            Some(SessionStatus::Running)
        );
        assert_eq!(
            status(&sessions, "agent-finished"),
            Some(SessionStatus::Ended)
        );

        // The tracked state follows appended records in both directions.
        crate::files::tests::append(
            &subagents.join("agent-idle.jsonl"),
            lines(&[turn("user", None)]).as_bytes(),
        );
        crate::files::tests::append(
            &subagents.join("agent-working.jsonl"),
            lines(&[
                turn("assistant", Some("end_turn")),
                turn("attachment", None),
            ])
            .as_bytes(),
        );
        let sessions = discovery.discover(&home.0, now);
        assert_eq!(
            status(&sessions, "agent-idle"),
            Some(SessionStatus::Running)
        );
        assert_eq!(
            status(&sessions, "agent-working"),
            Some(SessionStatus::Idle)
        );
    }
}
