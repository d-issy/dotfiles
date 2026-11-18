use std::path::{Path, PathBuf};

use super::parse::{parse_pi_record, pi_status, pi_turn_event};
use crate::files::{LogSummary, SummaryTracker, child_paths, modified_ms, read_first_record};
use crate::json::Fields;
use crate::model::{Agent, JsonObject, Session, SessionStatus};
use crate::text::{last_summary, one_line};

fn reduce(summary: &mut LogSummary, record: &JsonObject) {
    match record.str("type") {
        Some("session_info") => {
            summary.title = record.non_empty_str("name").map(one_line);
        }
        Some("model_change") => {
            summary.model = record.non_empty_str("modelId").map(str::to_string);
        }
        Some("message") => {
            let message = record.object("message");
            if let Some(model) = message.non_empty_str("model") {
                summary.model = Some(model.to_string());
            }
        }
        _ => {}
    }
    if let Some(status) = pi_status(record) {
        summary.status = Some(status);
    }
    if let Some(event) = pi_turn_event(record) {
        summary.turn.apply(event);
    }
    if let Some(last) = last_summary(&parse_pi_record(record)) {
        summary.last = Some(last);
    }
}

pub struct PiDiscovery {
    tracker: SummaryTracker,
}

impl PiDiscovery {
    pub fn new() -> Self {
        Self {
            tracker: SummaryTracker::new(reduce),
        }
    }

    /// Pi stores logs under one encoded-cwd directory per project.
    /// Also accept files directly in the root for a custom session directory.
    pub fn discover(&mut self, root: &Path, now: f64, window_ms: f64) -> Vec<Session> {
        let paths: Vec<PathBuf> = child_paths(root)
            .flat_map(|path| {
                if path.is_dir() {
                    child_paths(&path).collect()
                } else {
                    vec![path]
                }
            })
            .filter(|path| path.extension().is_some_and(|ext| ext == "jsonl"))
            .collect();
        let sessions = paths
            .into_iter()
            .filter_map(|path| {
                let updated_at = modified_ms(&path).filter(|time| *time >= now - window_ms)?;
                let header = read_first_record(&path)?;
                if header.str("type") != Some("session") {
                    return None;
                }
                let id = header.non_empty_str("id")?;
                let summary = self.tracker.summarize(&path);
                Some(Session {
                    // Custom IDs can be reused across projects (or log files).
                    key: format!("pi:{}", path.display()),
                    agent: Agent::Pi,
                    id: id.to_string(),
                    title: summary.title.unwrap_or_else(|| id.to_string()),
                    cwd: header.str("cwd").unwrap_or("").to_string(),
                    status: summary.status.unwrap_or(SessionStatus::Unknown),
                    updated_at,
                    started_at: header.time("timestamp"),
                    turn: summary.turn,
                    log_path: Some(path),
                    // parentSession is a fork source, not a running subagent.
                    parent_key: None,
                    model: summary.model,
                    last: summary.last,
                })
            })
            .collect();
        self.tracker.prune();
        sessions
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sessions::now_ms;
    use crate::test_support::{TempDir, append};
    use dot::json::{Value, json};
    use std::fs;

    fn line(value: Value) -> String {
        format!("{value}\n")
    }

    #[test]
    fn discovers_and_follows_pi_sessions() {
        let home = TempDir::new();
        let dir = home.path().join("--w-project--");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("2025-01-01_abc.jsonl");
        fs::write(
            &path,
            line(json!({
                "type": "session", "version": 3, "id": "abc", "cwd": "/w/project",
                "timestamp": "2025-01-01T00:00:00Z"
            })) + &line(json!({"type": "model_change", "modelId": "model-a"}))
                + &line(
                    json!({"type": "message", "message": {"role": "user", "content": "hello"}}),
                ),
        )
        .unwrap();
        let mut discovery = PiDiscovery::new();
        let mut discover = |window| discovery.discover(home.path(), now_ms(), window);
        let session = discover(3_600_000.0).pop().unwrap();
        assert_eq!(session.agent, Agent::Pi);
        assert_eq!(session.key, format!("pi:{}", path.display()));
        assert_eq!(session.cwd, "/w/project");
        assert_eq!(session.title, "abc");
        assert_eq!(session.status, SessionStatus::Running);
        assert_eq!(session.model.as_deref(), Some("model-a"));
        assert_eq!(session.last.as_deref(), Some("hello"));
        assert!(session.started_at.is_some());
        assert_eq!(session.log_path.as_deref(), Some(path.as_path()));
        append(
            &path,
            (line(json!({"type": "session_info", "name": "Named\nsession"}))
                + &line(json!({"type": "message", "message": {
                    "role": "assistant", "model": "model-b", "stopReason": "stop",
                    "content": [{"type": "text", "text": "done"}]
                }}))
                + &line(json!({"type": "custom", "data": "x".repeat(300 * 1024)})))
                .as_bytes(),
        );
        let session = discover(3_600_000.0).pop().unwrap();
        assert_eq!(session.title, "Named session");
        assert_eq!(session.status, SessionStatus::Idle);
        assert_eq!(session.model.as_deref(), Some("model-b"));
        assert_eq!(session.last.as_deref(), Some("done"));
        assert!(discover(-1.0).is_empty());
    }

    #[test]
    fn keeps_sessions_with_the_same_custom_id_in_the_tree() {
        let root = TempDir::new();
        for project in ["alpha", "beta"] {
            let dir = root.path().join(project);
            fs::create_dir_all(&dir).unwrap();
            fs::write(
                dir.join("session.jsonl"),
                line(json!({"type": "session", "id": "shared", "cwd": format!("/w/{project}")})),
            )
            .unwrap();
        }
        let mut discovery = PiDiscovery::new();
        let sessions = discovery.discover(root.path(), now_ms(), 3_600_000.0);
        assert_eq!(sessions.len(), 2);
        assert!(sessions.iter().all(|session| session.id == "shared"));
        assert_ne!(sessions[0].key, sessions[1].key);
        let rows = crate::sessions::to_rows(&sessions);
        assert_eq!(crate::sessions::session_indices(&rows).len(), 2);
        // Keys must also stay stable across refreshes.
        assert_eq!(
            sessions,
            discovery.discover(root.path(), now_ms(), 3_600_000.0)
        );
    }

    #[test]
    fn skips_invalid_logs_and_retries_partial_headers() {
        let home = TempDir::new();
        fs::write(home.path().join("invalid.jsonl"), "{}\n").unwrap();
        fs::write(home.path().join("ignore.txt"), "{}\n").unwrap();
        let path = home.path().join("session.jsonl");
        let header = line(json!({"type": "session", "id": "abc", "cwd": "/w"}));
        fs::write(&path, &header.as_bytes()[..10]).unwrap();
        let mut discovery = PiDiscovery::new();
        assert!(
            discovery
                .discover(home.path(), now_ms(), 3_600_000.0)
                .is_empty()
        );
        append(&path, &header.as_bytes()[10..]);
        let sessions = discovery.discover(home.path(), now_ms(), 3_600_000.0);
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].status, SessionStatus::Unknown);
        assert!(
            discovery
                .discover(&home.path().join("missing"), now_ms(), 3_600_000.0)
                .is_empty()
        );
    }
}
