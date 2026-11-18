use std::path::PathBuf;

use dot::json::Map;

pub type JsonObject = Map;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Agent {
    Claude,
    Codex,
    Pi,
}

impl Agent {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
            Self::Pi => "pi",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SessionStatus {
    Running,
    Waiting,
    Idle,
    Ended,
    Unknown,
}

impl SessionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Waiting => "waiting",
            Self::Idle => "idle",
            Self::Ended => "ended",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum TurnEvent {
    Start(Option<f64>),
    Response(Option<f64>),
    Finish(Option<f64>),
    Duration { elapsed: f64, at: Option<f64> },
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct TurnTiming {
    started_at: Option<f64>,
    end: Option<TurnEnd>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum TurnEnd {
    Response(Option<f64>),
    Timestamp(Option<f64>),
    Duration { elapsed: f64, at: Option<f64> },
}

impl TurnTiming {
    pub fn apply(&mut self, event: TurnEvent) {
        match event {
            TurnEvent::Start(time) => {
                self.started_at = time;
                self.end = None;
            }
            TurnEvent::Response(time) if matches!(self.end, None | Some(TurnEnd::Response(_))) => {
                self.end = Some(TurnEnd::Response(time));
            }
            TurnEvent::Finish(time) if !matches!(self.end, Some(TurnEnd::Duration { .. })) => {
                self.end = Some(TurnEnd::Timestamp(time));
            }
            TurnEvent::Duration { elapsed, at } => {
                self.end = Some(TurnEnd::Duration { elapsed, at });
            }
            TurnEvent::Response(_) | TurnEvent::Finish(_) => {}
        }
    }

    pub fn finished_at(self) -> Option<f64> {
        match self.end? {
            TurnEnd::Timestamp(at) | TurnEnd::Duration { at, .. } => at,
            TurnEnd::Response(_) => None,
        }
    }

    fn elapsed(self, status: SessionStatus, now: f64) -> Option<f64> {
        let active = matches!(status, SessionStatus::Running | SessionStatus::Waiting);
        let end = match self.end {
            Some(TurnEnd::Duration { elapsed, .. }) => return Some(elapsed),
            Some(TurnEnd::Timestamp(time)) => time?,
            // Claude can still run Stop hooks after writing the final response.
            Some(TurnEnd::Response(time)) if !active => time?,
            _ if active => now,
            _ => return None,
        };
        Some((end - self.started_at?).max(0.0))
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Session {
    pub key: String,
    pub agent: Agent,
    pub id: String,
    pub title: String,
    pub cwd: String,
    pub status: SessionStatus,
    /// Milliseconds since the epoch (may be fractional, like `mtimeMs`).
    pub updated_at: f64,
    pub started_at: Option<f64>,
    pub turn: TurnTiming,
    pub log_path: Option<PathBuf>,
    pub parent_key: Option<String>,
    pub model: Option<String>,
    pub last: Option<String>,
}

impl Session {
    pub fn turn_elapsed(&self, now: f64) -> Option<f64> {
        self.turn.elapsed(self.status, now)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntryKind {
    User,
    Assistant,
    Thinking,
    Tool,
    Result,
    Error,
    Status,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LogEntry {
    pub time: Option<f64>,
    pub kind: EntryKind,
    pub title: Option<String>,
    pub text: String,
}

impl LogEntry {
    pub fn new(time: Option<f64>, kind: EntryKind, text: impl Into<String>) -> Self {
        Self {
            time,
            kind,
            title: None,
            text: text.into(),
        }
    }

    pub fn titled(
        time: Option<f64>,
        kind: EntryKind,
        title: impl Into<String>,
        text: impl Into<String>,
    ) -> Self {
        Self {
            time,
            kind,
            title: Some(title.into()),
            text: text.into(),
        }
    }

    pub fn non_empty_title(&self) -> Option<&str> {
        self.title.as_deref().filter(|title| !title.is_empty())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_running_and_waiting_turns_count_up_to_now() {
        let mut turn = TurnTiming::default();
        turn.apply(TurnEvent::Start(Some(1_000.0)));
        for status in [SessionStatus::Running, SessionStatus::Waiting] {
            assert_eq!(turn.elapsed(status, 4_000.0), Some(3_000.0));
        }
        for status in [
            SessionStatus::Idle,
            SessionStatus::Ended,
            SessionStatus::Unknown,
        ] {
            assert_eq!(turn.elapsed(status, 4_000.0), None);
        }
        turn.apply(TurnEvent::Finish(Some(3_000.0)));
        assert_eq!(turn.elapsed(SessionStatus::Unknown, 5_000.0), Some(2_000.0));
    }
}
