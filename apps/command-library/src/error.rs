use std::fmt;

#[derive(Debug, PartialEq, Eq)]
pub enum Error {
    Usage(String),
    Failure(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn failure(message: impl Into<String>) -> Self {
        Self::Failure(message.into())
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Usage(message) | Self::Failure(message) => f.write_str(message),
        }
    }
}

impl std::error::Error for Error {}
