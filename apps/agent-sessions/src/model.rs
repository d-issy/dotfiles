use std::path::PathBuf;

use dot::json::Map;

pub type JsonObject = Map;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Agent {
    Claude,
    Codex,
}

impl Agent {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Codex => "codex",
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
    pub log_path: Option<PathBuf>,
    pub parent_key: Option<String>,
    pub model: Option<String>,
    pub last: Option<String>,
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
