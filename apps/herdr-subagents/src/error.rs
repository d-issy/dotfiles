use std::fmt;
use std::io;

/// Exit statuses `jq -e` used to produce in the original script; scripts depend on them.
pub const JQ_NULL_RESULT: i32 = 1;
pub const JQ_NO_OUTPUT: i32 = 4;
pub const JQ_RUNTIME_ERROR: i32 = 5;

#[derive(Debug)]
pub enum Error {
    Message(String),
    Exit(i32),
    Spawn {
        program: String,
        source: io::Error,
    },
    InvalidJson {
        origin: String,
        source: serde_json::Error,
    },
}

pub type Result<T> = std::result::Result<T, Error>;

pub fn die<T>(message: impl Into<String>) -> Result<T> {
    Err(Error::Message(message.into()))
}

impl Error {
    pub fn exit_code(&self) -> i32 {
        match self {
            Self::Message(_) => 1,
            Self::Exit(code) => *code,
            Self::Spawn { .. } => 127,
            Self::InvalidJson { .. } => 2,
        }
    }

    pub fn is_silent(&self) -> bool {
        matches!(self, Self::Exit(_))
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Message(message) => f.write_str(message),
            Self::Exit(_) => Ok(()),
            Self::Spawn { program, source } => write!(f, "{program}: {source}"),
            Self::InvalidJson { origin, source } => {
                write!(f, "invalid JSON from {origin}: {source}")
            }
        }
    }
}

impl std::error::Error for Error {}
