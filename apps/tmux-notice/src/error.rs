use std::fmt;
use std::io;

pub const USAGE: &str = "tmux-notice - pane-local tmux notice helper

Usage:
  tmux-notice on <notice> [-t <pane>]
  tmux-notice off [notice] [-t <pane>]
  tmux-notice clear [--pane|--window|--session|--all] [-t <target>]
  tmux-notice list

Notices are configured by dot.programs.scripts.tmuxNotice.notices.
";

#[derive(Debug)]
pub enum Error {
    NoCommand,
    UnknownCommand(String),
    MissingTarget(String),
    MissingNoticeName,
    UnknownClearOption(String),
    ConfigEnvMissing,
    ConfigRead {
        path: String,
        source: io::Error,
    },
    ConfigParse {
        path: String,
        source: dot::json::Error,
    },
    InvalidPattern {
        pattern: String,
        source: dot::regex::Error,
    },
}

impl Error {
    pub fn exit_code(&self) -> u8 {
        match self {
            Self::NoCommand
            | Self::UnknownCommand(_)
            | Self::MissingTarget(_)
            | Self::MissingNoticeName
            | Self::UnknownClearOption(_) => 2,
            Self::ConfigEnvMissing | Self::ConfigRead { .. } | Self::ConfigParse { .. } => 1,
            Self::InvalidPattern { .. } => 5,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let usage = USAGE.trim_end();
        match self {
            Self::NoCommand => f.write_str(usage),
            Self::UnknownCommand(c) => write!(f, "tmux-notice: unknown command: {c}\n{usage}"),
            Self::MissingTarget(flag) => write!(f, "tmux-notice: missing target after {flag}"),
            Self::MissingNoticeName => f.write_str("tmux-notice: missing notice name"),
            Self::UnknownClearOption(o) => write!(f, "tmux-notice: unknown clear option: {o}"),
            Self::ConfigEnvMissing => f.write_str("tmux-notice: TMUX_NOTICE_CONFIG is not set"),
            Self::ConfigRead { path, source } => {
                write!(f, "tmux-notice: cannot read {path}: {source}")
            }
            Self::ConfigParse { path, source } => {
                write!(f, "tmux-notice: invalid config {path}: {source}")
            }
            Self::InvalidPattern { pattern, source } => write!(
                f,
                "tmux-notice: invalid titleStripPatterns entry {pattern:?}: {source}"
            ),
        }
    }
}

impl std::error::Error for Error {}
