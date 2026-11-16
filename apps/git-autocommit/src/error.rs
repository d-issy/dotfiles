use crate::bash;
use dot::color::Color;
use std::fmt;
use std::io::{self, Write};

#[derive(Debug)]
pub enum Error {
    NotInRepository,
    PiNotFound,
    BranchCancelled,
    CommitCancelled,
    Config(String),
    Tty(io::Error),
    GitSpawn(io::Error),
    PiSpawn(io::Error),
    PiFailed(Vec<u8>),
    Exit(i32),
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn exit_code(&self) -> i32 {
        match self {
            Self::GitSpawn(_) => 127,
            Self::Exit(code) => *code,
            _ => 1,
        }
    }

    pub fn report(&self) {
        match self {
            Self::NotInRepository
            | Self::PiNotFound
            | Self::BranchCancelled
            | Self::CommitCancelled => {
                bash::say(&self.to_string());
            }
            Self::PiFailed(stderr) => {
                let _ = io::stderr().write_all(stderr);
            }
            Self::Exit(_) => {}
            Self::Config(_) | Self::Tty(_) | Self::GitSpawn(_) | Self::PiSpawn(_) => {
                eprintln!("{self}");
            }
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotInRepository => {
                write!(f, "{}", Color::Red.paint("Error: Not in a git repository"))
            }
            Self::PiNotFound => write!(f, "{}", Color::Red.paint("Error: pi CLI not found")),
            Self::BranchCancelled => write!(f, "{}", Color::Yellow.paint("Cancelled")),
            Self::CommitCancelled => write!(f, "{}", Color::Yellow.paint("Commit cancelled")),
            Self::Config(message) => f.write_str(message),
            Self::Tty(e) => write!(f, "/dev/tty: {e}"),
            Self::GitSpawn(e) => write!(f, "git: {e}"),
            Self::PiSpawn(e) => write!(f, "pi: {e}"),
            Self::PiFailed(_) | Self::Exit(_) => Ok(()),
        }
    }
}
