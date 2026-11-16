use std::fmt;
use std::io;

use crate::shell::os_error_text;
use crate::ui::Color;

#[derive(Debug)]
pub enum Error {
    /// Printed as `Error: <message>`; exits 1.
    Fatal(String),
    /// Printed as `<context>: <os error text>`; exits 1.
    Io { context: String, source: io::Error },
    /// Printed as is; exits 1.
    Message(String),
    /// A child process or prompt already reported the failure; exit with this status.
    Status(i32),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;

impl Error {
    pub fn fatal(message: impl Into<String>) -> Self {
        Self::Fatal(message.into())
    }

    pub fn io(context: impl Into<String>, source: io::Error) -> Self {
        Self::Io {
            context: context.into(),
            source,
        }
    }

    pub fn exit_code(&self) -> u8 {
        match self {
            Self::Fatal(_) | Self::Io { .. } | Self::Message(_) => 1,
            Self::Status(code) => u8::try_from(code & 0xff).unwrap_or(1),
        }
    }

    /// Print the message, if any, without stopping, like a `die` inside `$(...)`.
    pub fn report(&self) {
        if !matches!(self, Self::Status(_)) {
            eprintln!("{self}");
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Fatal(message) => write!(f, "{} {message}", Color::Red.paint("Error:")),
            Self::Io { context, source } => write!(f, "{context}: {}", os_error_text(source)),
            Self::Message(message) => f.write_str(message),
            Self::Status(code) => write!(f, "exit status {code}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}
