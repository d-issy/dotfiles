use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use crate::claude::{ClaudeDiscovery, parse_claude_record};
use crate::codex::{CodexDiscovery, parse_codex_record};
use crate::text::locale_compare;
use crate::types::{Agent, JsonObject, LogEntry, Session, SessionStatus};

#[derive(Clone, Debug, PartialEq)]
pub enum Row {
    Project {
        cwd: String,
        sessions: usize,
    },
    Session {
        session: Box<Session>,
        depth: usize,
        /// Tree guide drawn before the row, e.g. "├─ " or "│  └─ ".
        tree: String,
    },
}

/// A session row borrowed from the row list.
pub struct SessionRow<'a> {
    pub session: &'a Session,
    pub depth: usize,
    pub tree: &'a str,
}

/// Stable order: oldest start first so rows do not jump on every update.
fn by_start(a: &Session, b: &Session) -> Ordering {
    let diff = a.started_at.unwrap_or(a.updated_at) - b.started_at.unwrap_or(b.updated_at);
    if diff < 0.0 {
        Ordering::Less
    } else if diff > 0.0 {
        Ordering::Greater
    } else {
        locale_compare(&a.key, &b.key)
    }
}

fn by_project(a: &str, b: &str) -> Ordering {
    locale_compare(project_basename(a), project_basename(b)).then_with(|| locale_compare(a, b))
}

/// Node's `path.basename` for POSIX paths.
pub fn project_basename(path: &str) -> &str {
    let trimmed = path.trim_end_matches('/');
    match trimmed.rfind('/') {
        Some(index) => &trimmed[index + 1..],
        None => trimmed,
    }
}

struct Builder<'a> {
    children: HashMap<&'a str, Vec<&'a Session>>,
    seen: HashSet<&'a str>,
    rows: Vec<Row>,
}

impl<'a> Builder<'a> {
    fn visit_all(&mut self, list: &[&'a Session], depth: usize, guide: &str) {
        let mut pending: Vec<&'a Session> = list
            .iter()
            .copied()
            .filter(|session| !self.seen.contains(session.key.as_str()))
            .collect();
        pending.sort_by(|a, b| by_start(a, b));
        let count = pending.len();
        for (index, session) in pending.into_iter().enumerate() {
            if !self.seen.insert(session.key.as_str()) {
                continue;
            }
            let last = index + 1 == count;
            self.rows.push(Row::Session {
                session: Box::new(session.clone()),
                depth,
                tree: format!("{guide}{}", if last { "└─ " } else { "├─ " }),
            });
            let children = self
                .children
                .get(session.key.as_str())
                .cloned()
                .unwrap_or_default();
            self.visit_all(
                &children,
                depth + 1,
                &format!("{guide}{}", if last { "   " } else { "│  " }),
            );
        }
    }
}

/// Group sessions by project, each project followed by its session tree.
pub fn to_rows(sessions: &[Session]) -> Vec<Row> {
    let keys: HashSet<&str> = sessions
        .iter()
        .map(|session| session.key.as_str())
        .collect();
    let mut children: HashMap<&str, Vec<&Session>> = HashMap::new();
    let mut projects: Vec<(&str, Vec<&Session>)> = Vec::new();
    for session in sessions {
        match session.parent_key.as_deref() {
            Some(parent)
                if !parent.is_empty() && keys.contains(parent) && parent != session.key =>
            {
                children.entry(parent).or_default().push(session);
            }
            _ => match projects.iter_mut().find(|(cwd, _)| *cwd == session.cwd) {
                Some((_, list)) => list.push(session),
                None => projects.push((&session.cwd, vec![session])),
            },
        }
    }
    projects.sort_by(|a, b| by_project(a.0, b.0));
    let mut builder = Builder {
        children,
        seen: HashSet::new(),
        rows: Vec::new(),
    };
    for (cwd, roots) in projects {
        builder.rows.push(Row::Project {
            cwd: cwd.to_string(),
            sessions: roots.len(),
        });
        builder.visit_all(&roots, 0, "");
    }
    builder.rows
}

/// Indices of the session rows.
pub fn session_rows(rows: &[Row]) -> Vec<usize> {
    rows.iter()
        .enumerate()
        .filter(|(_, row)| matches!(row, Row::Session { .. }))
        .map(|(index, _)| index)
        .collect()
}

pub fn session_row(row: &Row) -> Option<SessionRow<'_>> {
    match row {
        Row::Session {
            session,
            depth,
            tree,
        } => Some(SessionRow {
            session,
            depth: *depth,
            tree,
        }),
        Row::Project { .. } => None,
    }
}

/// Hide idle sessions, including subagents whose main session is hidden.
pub fn filter_sessions(sessions: Vec<Session>, show_idle: bool) -> Vec<Session> {
    sessions
        .into_iter()
        .filter(|session| show_idle || session.status != SessionStatus::Idle)
        .collect()
}

pub fn parse_record(session: &Session, record: &JsonObject) -> Vec<LogEntry> {
    match session.agent {
        Agent::Claude => parse_claude_record(record),
        Agent::Codex => parse_codex_record(record),
    }
}

/// Elapsed run time: active sessions count up to now, finished ones stop at
/// their last log write.
pub fn session_runtime(session: &Session, now: f64) -> Option<f64> {
    let started_at = session.started_at?;
    let active = matches!(
        session.status,
        SessionStatus::Running | SessionStatus::Waiting
    );
    Some(((if active { now } else { session.updated_at }) - started_at).max(0.0))
}

fn home_dir() -> PathBuf {
    std::env::home_dir().unwrap_or_default()
}

pub fn home_string() -> String {
    home_dir().to_string_lossy().into_owned()
}

fn env_or_home(name: &str, default: &str) -> PathBuf {
    std::env::var_os(name).map_or_else(|| home_dir().join(default), PathBuf::from)
}

/// Discovery state that persists across refreshes (summaries and caches).
pub struct Discovery {
    claude_home: PathBuf,
    codex_home: PathBuf,
    claude: ClaudeDiscovery,
    codex: CodexDiscovery,
}

impl Discovery {
    pub fn new() -> Self {
        Self {
            claude_home: env_or_home("CLAUDE_CONFIG_DIR", ".claude"),
            codex_home: env_or_home("CODEX_HOME", ".codex"),
            claude: ClaudeDiscovery::new(),
            codex: CodexDiscovery::new(),
        }
    }

    pub fn discover(&mut self, window_ms: f64, now: f64) -> Vec<Session> {
        let mut sessions = self.claude.discover(&self.claude_home, now);
        sessions.extend(self.codex.discover(&self.codex_home, now, window_ms));
        sessions
    }
}

pub fn now_ms() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0.0, |elapsed| elapsed.as_millis() as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(key: &str, updated_at: f64, parent_key: Option<&str>) -> Session {
        Session {
            key: key.into(),
            agent: Agent::Codex,
            id: key.into(),
            title: key.into(),
            cwd: "/tmp".into(),
            status: SessionStatus::Idle,
            updated_at,
            started_at: None,
            log_path: String::new(),
            parent_key: parent_key.map(Into::into),
            model: None,
            last: None,
        }
    }

    fn with_status(mut session: Session, status: SessionStatus) -> Session {
        session.status = status;
        session
    }

    fn keys(sessions: &[Session]) -> Vec<&str> {
        sessions
            .iter()
            .map(|session| session.key.as_str())
            .collect()
    }

    fn session_list(rows: &[Row]) -> Vec<SessionRow<'_>> {
        session_rows(rows)
            .into_iter()
            .filter_map(|index| session_row(&rows[index]))
            .collect()
    }

    #[test]
    fn hides_idle_sessions_by_default_and_can_show_them() {
        let sessions = vec![
            session("idle-main", 1.0, None),
            with_status(session("running-main", 2.0, None), SessionStatus::Running),
            with_status(session("waiting-main", 3.0, None), SessionStatus::Waiting),
            with_status(session("unknown-main", 4.0, None), SessionStatus::Unknown),
            with_status(session("ended-main", 5.0, None), SessionStatus::Ended),
            session("idle-child", 6.0, Some("idle-main")),
            with_status(
                session("ended-child", 7.0, Some("missing")),
                SessionStatus::Ended,
            ),
            with_status(
                session("waiting-child", 8.0, Some("idle-main")),
                SessionStatus::Waiting,
            ),
        ];
        assert_eq!(
            keys(&filter_sessions(sessions.clone(), false)),
            [
                "running-main",
                "waiting-main",
                "unknown-main",
                "ended-main",
                "ended-child",
                "waiting-child",
            ]
        );
        assert_eq!(filter_sessions(sessions.clone(), true), sessions);
    }

    #[test]
    fn keeps_descendants_in_the_tree_when_their_idle_main_session_is_hidden() {
        let sessions = vec![
            session("main", 1.0, None),
            with_status(session("child", 2.0, Some("main")), SessionStatus::Running),
            with_status(
                session("grandchild", 3.0, Some("child")),
                SessionStatus::Waiting,
            ),
        ];
        let rows = to_rows(&filter_sessions(sessions, false));
        let list: Vec<(&str, usize)> = session_list(&rows)
            .iter()
            .map(|row| (row.session.key.as_str(), row.depth))
            .collect();
        assert_eq!(list, [("child", 0), ("grandchild", 1)]);
    }

    #[test]
    fn leaves_no_rows_for_an_idle_main_session_and_its_idle_child() {
        let sessions = vec![
            session("main", 1.0, None),
            session("child", 2.0, Some("main")),
        ];
        assert_eq!(to_rows(&filter_sessions(sessions, false)), []);
    }

    #[test]
    fn groups_by_project_and_orders_sessions_by_start_time() {
        let at = |mut session: Session, cwd: &str, started_at: Option<f64>| {
            session.cwd = cwd.into();
            session.started_at = started_at;
            session
        };
        let rows = to_rows(&[
            at(session("b2", 9.0, None), "/w/beta", Some(2.0)),
            at(session("b1", 1.0, None), "/w/beta", Some(1.0)),
            at(session("a1", 5.0, None), "/w/alpha", None),
            at(session("child", 5.0, Some("b1")), "/w/other", None),
            at(session("orphan", 2.0, Some("missing")), "/w/alpha", None),
        ]);
        let described: Vec<String> = rows
            .iter()
            .map(|row| match row {
                Row::Project { cwd, sessions } => format!("{cwd} ({sessions})"),
                Row::Session { session, tree, .. } => format!("{tree}{}", session.key),
            })
            .collect();
        assert_eq!(
            described,
            [
                "/w/alpha (2)",
                "├─ orphan",
                "└─ a1",
                "/w/beta (2)",
                "├─ b1",
                "│  └─ child",
                "└─ b2",
            ]
        );
        let depths: Vec<usize> = session_list(&rows).iter().map(|row| row.depth).collect();
        assert_eq!(depths, [0, 0, 0, 1, 0]);
    }

    #[test]
    fn counts_active_sessions_to_now_and_finished_ones_to_the_last_write() {
        let base = session("s", 5_000.0, None);
        let started = |status| Session {
            status,
            started_at: Some(1_000.0),
            ..base.clone()
        };
        assert_eq!(
            session_runtime(&started(SessionStatus::Idle), 9_000.0),
            Some(4_000.0)
        );
        assert_eq!(
            session_runtime(&started(SessionStatus::Running), 9_000.0),
            Some(8_000.0)
        );
        assert_eq!(session_runtime(&base, 9_000.0), None);
    }
}
