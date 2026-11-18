use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use dot::json::Value;
use dot::process::process_exists;

use super::parse::{
    claude_model, claude_title, claude_turn_event, claude_turn_status, parse_claude_record,
    registry_status,
};
use crate::files::{
    LogSummary, SummaryTracker, list_dir, modified_ms, read_first_record, read_json_file,
};
use crate::json::Fields;
use crate::model::{Agent, JsonObject, Session, SessionStatus, TurnEvent};
use crate::text::{last_summary, one_line};

/// Finished subagents stay listed briefly so their final output is visible.
const FINISHED_SUBAGENT_MS: f64 = 10.0 * 60_000.0;

/// The `starttime` field of `/proc/<pid>/stat`, counted after the
/// parenthesized command name because that name may contain spaces.
fn proc_start_time(stat: &str) -> Option<&str> {
    let after_command = stat.rsplit_once(')').map_or(stat, |(_, rest)| rest);
    let mut chars = after_command.chars();
    chars.next();
    chars.as_str().split(' ').nth(19)
}

/// `process.kill(pid, 0)` only accepts 32-bit integer pids.
fn registry_pid(entry: &JsonObject) -> Option<i32> {
    let pid = entry.get("pid").and_then(Value::as_f64)?;
    if pid <= 0.0 || pid.fract() != 0.0 || pid > f64::from(i32::MAX) {
        return None;
    }
    Some(pid as i32)
}

fn is_alive(entry: &JsonObject) -> bool {
    let Some(pid) = registry_pid(entry) else {
        return false;
    };
    if !process_exists(pid) {
        return false;
    }
    // A recorded start time guards against PID reuse.
    let Some(expected) = entry.str("procStart") else {
        return true;
    };
    match fs::read(format!("/proc/{pid}/stat")) {
        Ok(stat) => proc_start_time(&String::from_utf8_lossy(&stat)) == Some(expected),
        Err(_) => true,
    }
}

fn encode_project_dir(cwd: &str) -> String {
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
    let file_name = format!("{id}.jsonl");
    let direct = projects.join(encode_project_dir(cwd)).join(&file_name);
    if modified_ms(&direct).is_some() {
        return Some(direct);
    }
    list_dir(&projects)
        .into_iter()
        .map(|dir| projects.join(dir).join(&file_name))
        .find(|candidate| modified_ms(candidate).is_some())
}

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
    if let Some(event) = claude_turn_event(record) {
        if matches!(event, TurnEvent::Finish(_) | TurnEvent::Duration { .. }) {
            summary.status = Some(SessionStatus::Idle);
        }
        summary.turn.apply(event);
    }
}

pub struct ClaudeDiscovery {
    tracker: SummaryTracker,
    start_times: HashMap<PathBuf, f64>,
}

impl ClaudeDiscovery {
    pub fn new() -> Self {
        Self {
            tracker: SummaryTracker::new(reduce),
            start_times: HashMap::new(),
        }
    }

    pub fn summarize_log(&mut self, path: &Path) -> LogSummary {
        self.tracker.summarize(path)
    }

    pub fn discover(&mut self, home: &Path, now: f64) -> Vec<Session> {
        let registry = home.join("sessions");
        let mut sessions = Vec::new();
        for name in list_dir(&registry) {
            if !name.ends_with(".json") {
                continue;
            }
            let Some(entry) = read_json_file(&registry.join(&name)) else {
                continue;
            };
            let Some(session) = self.registry_session(home, &entry) else {
                continue;
            };
            let subagents = match &session.log_path {
                Some(transcript) => self.subagent_sessions(transcript, &session, now),
                None => Vec::new(),
            };
            sessions.push(session);
            sessions.extend(subagents);
        }
        self.tracker.prune();
        sessions
    }

    fn registry_session(&mut self, home: &Path, entry: &JsonObject) -> Option<Session> {
        if !is_alive(entry) {
            return None;
        }
        let id = entry.non_empty_str("sessionId")?.to_string();
        let cwd = entry.str("cwd").unwrap_or("").to_string();
        let log_path = find_transcript(home, &cwd, &id);
        let summary = log_path
            .as_deref()
            .map(|path| self.summarize_log(path))
            .unwrap_or_default();
        let registry_state = entry.str("status");
        let status = if registry_state == Some("busy")
            && summary.status == Some(SessionStatus::Idle)
            && let Some(finished_at) = summary.turn.finished_at()
            && entry
                .time("statusUpdatedAt")
                .is_some_and(|status_at| status_at < finished_at)
        {
            SessionStatus::Idle
        } else {
            registry_status(registry_state)
        };
        Some(Session {
            key: format!("claude:{id}"),
            agent: Agent::Claude,
            title: summary
                .title
                .unwrap_or_else(|| one_line(entry.str("name").unwrap_or(&id))),
            cwd,
            status,
            started_at: entry.time("startedAt"),
            turn: summary.turn,
            updated_at: log_path
                .as_deref()
                .and_then(modified_ms)
                .or_else(|| entry.time("updatedAt"))
                .unwrap_or(0.0),
            log_path,
            parent_key: None,
            model: summary.model,
            last: summary.last,
            id,
        })
    }

    fn subagent_sessions(&mut self, transcript: &Path, parent: &Session, now: f64) -> Vec<Session> {
        let transcript = transcript.to_string_lossy();
        let dir =
            Path::new(transcript.strip_suffix(".jsonl").unwrap_or(&transcript)).join("subagents");
        list_dir(&dir)
            .into_iter()
            .filter_map(|name| {
                let id = name.strip_suffix(".jsonl")?;
                self.subagent_session(&dir, id, parent, now)
            })
            .collect()
    }

    fn subagent_session(
        &mut self,
        dir: &Path,
        id: &str,
        parent: &Session,
        now: f64,
    ) -> Option<Session> {
        let path = dir.join(format!("{id}.jsonl"));
        let updated_at = modified_ms(&path).unwrap_or(0.0);
        let meta = read_json_file(&dir.join(format!("{id}.meta.json"))).unwrap_or_default();
        let finished = meta.is_true("finished");
        if finished && now - updated_at > FINISHED_SUBAGENT_MS {
            return None;
        }
        let description = meta.str("description").unwrap_or(id);
        let title = match meta.non_empty_str("agentType") {
            Some(kind) => one_line(&format!("{kind}: {description}")),
            None => one_line(description),
        };
        let summary = self.summarize_log(&path);
        Some(Session {
            key: format!("claude:{}:{id}", parent.id),
            agent: Agent::Claude,
            id: id.to_string(),
            title,
            cwd: parent.cwd.clone(),
            status: if finished {
                SessionStatus::Ended
            } else {
                summary.status.unwrap_or(SessionStatus::Running)
            },
            updated_at,
            started_at: self.first_timestamp(&path),
            turn: summary.turn,
            log_path: Some(path),
            parent_key: Some(parent.key.clone()),
            model: summary.model,
            last: summary.last,
        })
    }

    /// A subagent transcript starts with its prompt, so the first timestamp is
    /// its start. Only successful reads are cached: the first line may still
    /// be mid-write.
    fn first_timestamp(&mut self, path: &Path) -> Option<f64> {
        if let Some(cached) = self.start_times.get(path) {
            return Some(*cached);
        }
        let time = read_first_record(path)?.time("timestamp")?;
        self.start_times.insert(path.to_path_buf(), time);
        Some(time)
    }
}

#[cfg(test)]
mod tests {
    use super::super::parse::tests::turn;
    use super::*;
    use crate::test_support::{TempDir, append, jsonl, object};
    use dot::json::json;

    #[test]
    fn encodes_project_directories_like_claude_code() {
        assert_eq!(
            encode_project_dir("/home/u/code/github.com/a/b.c"),
            "-home-u-code-github-com-a-b-c"
        );
    }

    #[test]
    fn reads_the_process_start_time_even_when_the_command_has_spaces() {
        let fields: Vec<String> = (3..33).map(|field| field.to_string()).collect();
        assert_eq!(
            proc_start_time(&format!("123 (a b) {}", fields.join(" "))),
            Some("22")
        );
    }

    #[test]
    fn times_peer_turns_and_stops_when_claude_becomes_inactive() {
        let home = TempDir::new();
        let now = crate::sessions::now_ms();
        let registry = home.path().join("sessions/1.json");
        fs::create_dir_all(registry.parent().unwrap()).unwrap();
        let set_status = |status: &str, at: f64| {
            fs::write(
                &registry,
                json!({
                    "pid": std::process::id(), "sessionId": "main",
                    "cwd": "/w/p", "status": status, "statusUpdatedAt": at,
                })
                .to_string(),
            )
            .unwrap();
        };
        set_status("busy", now - 20_000.0);
        let project = home.path().join("projects/-w-p");
        let subagents = project.join("main/subagents");
        fs::create_dir_all(&subagents).unwrap();
        let transcript = project.join("main.jsonl");
        let completed_turn = |duration| {
            object(json!({"type": "system", "subtype": "turn_duration", "durationMs": duration}))
        };
        fs::write(&transcript, jsonl(&[completed_turn(5_000)])).unwrap();
        fs::write(
            subagents.join("agent-finished.jsonl"),
            jsonl(&[object(json!({
                "type": "user", "timestamp": 1_000, "message": {"content": "subagent task"},
            }))]),
        )
        .unwrap();
        fs::write(
            subagents.join("agent-finished.meta.json"),
            json!({"finished": true}).to_string(),
        )
        .unwrap();

        let mut discovery = ClaudeDiscovery::new();
        let mut main_session = |at| {
            let sessions = discovery.discover(home.path(), at);
            let finished = sessions.iter().find(|s| s.id == "agent-finished").unwrap();
            assert_eq!(finished.status, SessionStatus::Ended);
            assert_eq!(finished.turn_elapsed(at), None);
            sessions.into_iter().find(|s| s.id == "main").unwrap()
        };

        assert_eq!(main_session(now).turn_elapsed(now), Some(5_000.0));
        let peer_turn = |index, at| {
            object(json!({
                "type": "user", "isMeta": true, "timestamp": at,
                "promptSource": "system", "turnOrigin": "peer",
                "turnPosition": {"turnIndex": index},
                "message": {"content": "peer message"},
            }))
        };
        append(
            &transcript,
            jsonl(&[peer_turn(2, now - 1_000.0)]).as_bytes(),
        );
        let active = main_session(now);
        assert_eq!(active.status, SessionStatus::Running);
        assert_eq!(active.turn_elapsed(now), Some(1_000.0));
        assert_eq!(active.turn_elapsed(now + 1_000.0), Some(2_000.0));

        append(
            &transcript,
            jsonl(&[object(json!({
                "type": "assistant", "timestamp": now + 1_000.0,
                "message": {"stop_reason": "end_turn", "content": [{"type": "text", "text": "ok"}]},
            }))])
            .as_bytes(),
        );
        let stopping = main_session(now + 2_000.0);
        assert_eq!(stopping.status, SessionStatus::Running);
        assert_eq!(stopping.turn_elapsed(now + 2_000.0), Some(3_000.0));
        append(
            &transcript,
            jsonl(&[object(json!({
                "type": "system", "subtype": "stop_hook_summary",
                "preventedContinuation": false, "timestamp": now + 3_000.0,
            }))])
            .as_bytes(),
        );
        let completed = main_session(now + 4_000.0);
        assert_eq!(completed.status, SessionStatus::Idle);
        assert_eq!(completed.turn_elapsed(now + 4_000.0), Some(4_000.0));

        append(
            &transcript,
            jsonl(&[peer_turn(3, now + 5_000.0)]).as_bytes(),
        );
        set_status("idle", now + 6_000.0);
        let idle = main_session(now + 7_000.0);
        assert_eq!(idle.status, SessionStatus::Idle);
        assert_eq!(idle.turn_elapsed(now + 7_000.0), None);
        assert_eq!(idle.turn_elapsed(now + 8_000.0), None);

        append(&transcript, jsonl(&[completed_turn(3_000)]).as_bytes());
        assert_eq!(
            main_session(now + 9_000.0).turn_elapsed(now + 9_000.0),
            Some(3_000.0)
        );
    }

    #[test]
    fn keeps_a_thinking_subagent_visible_until_its_final_response() {
        use crate::sessions::filter_sessions;

        let home = TempDir::new();
        let registry = home.path().join("sessions");
        let project = home.path().join("projects/-w-p");
        let subagents = project.join("main/subagents");
        fs::create_dir_all(&registry).unwrap();
        fs::create_dir_all(&subagents).unwrap();
        fs::write(
            registry.join("1.json"),
            json!({"pid": std::process::id(), "sessionId": "main", "cwd": "/w/p", "status": "busy"})
                .to_string(),
        )
        .unwrap();
        fs::write(project.join("main.jsonl"), "").unwrap();
        let transcript = subagents.join("agent-thinking.jsonl");
        fs::write(
            &transcript,
            jsonl(&[
                object(json!({
                    "type": "user", "timestamp": 1_000, "message": {"content": "subagent task"},
                })),
                object(json!({
                    "type": "assistant", "timestamp": 2_000, "message": {
                        "stop_reason": "end_turn", "content": [
                            {"type": "thinking", "thinking": "working"}, {"type": "redacted_thinking"},
                        ],
                    },
                })),
            ]),
        )
        .unwrap();

        let mut discovery = ClaudeDiscovery::new();
        let mut find_subagent = |now, show_idle| {
            filter_sessions(discovery.discover(home.path(), now), show_idle)
                .into_iter()
                .find(|session| session.id == "agent-thinking")
        };
        for (now, elapsed) in [(3_000.0, 2_000.0), (4_000.0, 3_000.0)] {
            let thinking = find_subagent(now, false).expect("thinking subagent stays visible");
            assert_eq!(thinking.status, SessionStatus::Running);
            assert_eq!(thinking.turn_elapsed(now), Some(elapsed));
        }

        append(
            &transcript,
            jsonl(&[object(json!({
                "type": "assistant", "timestamp": 5_000,
                "message": {"stop_reason": "end_turn", "content": [{"type": "text", "text": "done"}]},
            }))])
            .as_bytes(),
        );
        assert!(find_subagent(6_000.0, false).is_none());
        let completed = find_subagent(6_000.0, true).unwrap();
        assert_eq!(completed.status, SessionStatus::Idle);
        assert_eq!(completed.turn_elapsed(6_000.0), Some(4_000.0));
    }

    #[test]
    fn shows_idle_subagents_as_idle() {
        let home = TempDir::new();
        let pid = std::process::id();
        fs::create_dir_all(home.path().join("sessions")).unwrap();
        fs::write(
            home.path().join("sessions/1.json"),
            json!({"pid": pid, "sessionId": "main", "cwd": "/w/p", "status": "busy"}).to_string(),
        )
        .unwrap();
        let project = home.path().join("projects/-w-p");
        let subagents = project.join("main/subagents");
        fs::create_dir_all(&subagents).unwrap();
        // The main transcript's own last turn ended, but the registry says busy.
        fs::write(
            project.join("main.jsonl"),
            jsonl(&[turn("user", None), turn("assistant", Some("end_turn"))]),
        )
        .unwrap();
        let agents = [
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
            fs::write(subagents.join(format!("{name}.jsonl")), jsonl(records)).unwrap();
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
        let sessions = discovery.discover(home.path(), now);
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

        append(
            &subagents.join("agent-idle.jsonl"),
            jsonl(&[turn("user", None)]).as_bytes(),
        );
        append(
            &subagents.join("agent-working.jsonl"),
            jsonl(&[
                turn("assistant", Some("end_turn")),
                turn("attachment", None),
            ])
            .as_bytes(),
        );
        let sessions = discovery.discover(home.path(), now);
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
