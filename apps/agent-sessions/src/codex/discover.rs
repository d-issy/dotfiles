use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::parse::{codex_model, codex_turn_event, parse_codex_record};
use crate::files::{LogSummary, SummaryTracker, child_paths, modified_ms, read_first_record};
use crate::json::{Fields, parse_object_line};
use crate::model::{Agent, JsonObject, Session, SessionStatus, TurnEvent};
use crate::text::{last_summary, one_line};

fn thread_names(home: &Path) -> HashMap<String, String> {
    let Ok(index) = fs::read(home.join("session_index.jsonl")) else {
        return HashMap::new();
    };
    String::from_utf8_lossy(&index)
        .split('\n')
        .filter_map(parse_object_line)
        .filter_map(|record| {
            let id = record.non_empty_str("id")?;
            let name = record.non_empty_str("thread_name")?;
            Some((id.to_string(), name.to_string()))
        })
        .collect()
}

fn is_rollout(path: &Path) -> bool {
    path.file_name()
        .map(|name| name.to_string_lossy())
        .is_some_and(|name| name.starts_with("rollout-") && name.ends_with(".jsonl"))
}

/// Rollouts live under `<year>/<month>/<day>/`; a resumed session keeps
/// writing to its original day, so every day is scanned.
fn rollout_paths(root: &Path) -> Vec<PathBuf> {
    child_paths(root)
        .flat_map(|year| child_paths(&year).collect::<Vec<_>>())
        .flat_map(|month| child_paths(&month).collect::<Vec<_>>())
        .flat_map(|day| {
            child_paths(&day)
                .filter(|path| is_rollout(path))
                .collect::<Vec<_>>()
        })
        .collect()
}

fn reduce(summary: &mut LogSummary, record: &JsonObject) {
    let records = std::slice::from_ref(record);
    if let Some(event) = codex_turn_event(record) {
        summary.status = Some(match event {
            TurnEvent::Start(_) | TurnEvent::Response(_) => SessionStatus::Running,
            TurnEvent::Finish(_) | TurnEvent::Duration { .. } => SessionStatus::Idle,
        });
        summary.turn.apply(event);
    }
    if let Some(model) = codex_model(records) {
        summary.model = Some(model);
    }
    if let Some(last) = last_summary(&parse_codex_record(record)) {
        summary.last = Some(last);
    }
}

fn is_guardian(meta: &JsonObject) -> bool {
    meta.str("thread_source") == Some("guardian_review")
        || meta.object("source").object("subagent").str("other") == Some("guardian")
}

fn session_title(names: &HashMap<String, String>, meta: &JsonObject, id: &str) -> String {
    if let Some(name) = names.get(id) {
        return name.clone();
    }
    match (
        meta.non_empty_str("agent_nickname"),
        meta.non_empty_str("agent_path"),
    ) {
        (Some(nickname), Some(path)) => format!("{nickname} ({path})"),
        (Some(nickname), None) => nickname.to_string(),
        (None, _) => id.to_string(),
    }
}

pub struct CodexDiscovery {
    tracker: SummaryTracker,
    // session_meta is written once at the top of a rollout. Only successful
    // reads are cached: the first line may still be mid-write.
    metas: HashMap<PathBuf, JsonObject>,
}

impl CodexDiscovery {
    pub fn new() -> Self {
        Self {
            tracker: SummaryTracker::new(reduce),
            metas: HashMap::new(),
        }
    }

    pub fn summarize_log(&mut self, path: &Path) -> LogSummary {
        self.tracker.summarize(path)
    }

    fn session_meta(&mut self, path: &Path) -> Option<JsonObject> {
        if let Some(cached) = self.metas.get(path) {
            return Some(cached.clone());
        }
        let first = read_first_record(path)?;
        if first.str("type") != Some("session_meta") {
            return None;
        }
        let meta = first.object("payload").clone();
        self.metas.insert(path.to_path_buf(), meta.clone());
        Some(meta)
    }

    pub fn discover(&mut self, home: &Path, now: f64, window_ms: f64) -> Vec<Session> {
        let since = now - window_ms;
        let names = thread_names(home);
        let sessions = rollout_paths(&home.join("sessions"))
            .into_iter()
            .filter_map(|path| {
                let updated_at = modified_ms(&path).filter(|time| *time >= since)?;
                self.rollout_session(&names, path, updated_at)
            })
            .collect();
        self.tracker.prune();
        sessions
    }

    fn rollout_session(
        &mut self,
        names: &HashMap<String, String>,
        path: PathBuf,
        updated_at: f64,
    ) -> Option<Session> {
        let meta = self.session_meta(&path)?;
        if is_guardian(&meta) {
            return None;
        }
        let id = meta.non_empty_str("id")?;
        let summary = self.summarize_log(&path);
        Some(Session {
            key: format!("codex:{id}"),
            agent: Agent::Codex,
            id: id.to_string(),
            title: one_line(&session_title(names, &meta, id)),
            cwd: meta.str("cwd").unwrap_or("").to_string(),
            status: summary.status.unwrap_or(SessionStatus::Unknown),
            updated_at,
            started_at: meta.time("timestamp"),
            turn: summary.turn,
            log_path: Some(path),
            parent_key: meta
                .non_empty_str("parent_thread_id")
                .map(|parent| format!("codex:{parent}")),
            model: summary.model,
            last: summary.last,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::js::date_parse;
    use crate::sessions::now_ms;
    use crate::test_support::{TempDir, append};
    use dot::json::{Value, json};

    fn line(value: Value) -> String {
        format!("{value}\n")
    }

    fn event_line(kind: &str, timestamp: &str) -> String {
        line(json!({"type": "event_msg", "timestamp": timestamp, "payload": {"type": kind}}))
    }

    fn noise(bytes: usize) -> String {
        line(
            json!({"type": "event_msg", "payload": {"type": "token_count", "pad": "x".repeat(bytes)}}),
        )
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
            let dir = home.path().join("sessions/2025/01/02");
            fs::create_dir_all(&dir).unwrap();
            let rollout = dir.join("rollout-2025-01-02T00-00-00-abc.jsonl");
            fs::write(
                &rollout,
                line(json!({
                    "type": "session_meta",
                    "payload": {"id": "abc", "cwd": "/w/p", "timestamp": "2025-01-02T00:00:00Z"},
                })) + &line(json!({"type": "turn_context", "payload": {"model": "gpt-a"}}))
                    + &event_line("task_started", "2025-01-02T00:00:01Z"),
            )
            .unwrap();
            Self {
                home,
                rollout,
                discovery: CodexDiscovery::new(),
            }
        }

        fn sessions(&mut self) -> Vec<Session> {
            self.discovery
                .discover(self.home.path(), now_ms(), 3_600_000.0)
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
        let dir = fixture.home.path().join("sessions/2025/01/03");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("rollout-2025-01-03T00-00-00-new.jsonl");
        let meta = line(json!({"type": "session_meta", "payload": {"id": "new", "cwd": "/w/p"}}));
        fs::write(&path, &meta.as_bytes()[..20]).unwrap();
        assert!(!fixture.ids().contains(&"new".to_string()));
        append(&path, &meta.as_bytes()[20..]);
        assert!(fixture.ids().contains(&"new".to_string()));
    }

    #[test]
    fn keeps_turn_timing_status_and_model_current_across_large_output_bursts() {
        let mut fixture = Fixture::new();
        let session = fixture.find().unwrap();
        let now = date_parse("2025-01-02T00:00:03Z").unwrap();
        assert_eq!(session.status, SessionStatus::Running);
        assert_eq!(session.turn_elapsed(now), Some(2_000.0));
        append(
            &fixture.rollout,
            (event_line("task_complete", "2025-01-02T00:00:06Z") + &noise(300 * 1024)).as_bytes(),
        );
        let session = fixture.find().unwrap();
        let now = date_parse("2025-01-02T00:02:00Z").unwrap();
        assert_eq!(session.status, SessionStatus::Idle);
        assert_eq!(session.turn_elapsed(now), Some(5_000.0));
        append(
            &fixture.rollout,
            (line(json!({"type": "turn_context", "payload": {"model": "gpt-b"}}))
                + &event_line("task_started", "2025-01-02T00:01:57Z")
                + &noise(300 * 1024))
                .as_bytes(),
        );
        let session = fixture.find().unwrap();
        assert_eq!(session.status, SessionStatus::Running);
        assert_eq!(session.model.as_deref(), Some("gpt-b"));
        assert_eq!(session.turn_elapsed(now), Some(3_000.0));
        append(
            &fixture.rollout,
            line(json!({
                "type": "event_msg",
                "timestamp": "2025-01-02T00:02:05Z",
                "payload": {"type": "turn_aborted", "duration_ms": 7_000},
            }))
            .as_bytes(),
        );
        let session = fixture.find().unwrap();
        let now = date_parse("2025-01-02T00:10:00Z").unwrap();
        assert_eq!(session.status, SessionStatus::Idle);
        assert_eq!(session.turn_elapsed(now), Some(7_000.0));
    }
}
