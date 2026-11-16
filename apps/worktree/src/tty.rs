use std::fs::{File, OpenOptions};
use std::io::{IsTerminal, Read, Write};
use std::path::Path;

use crate::error::{Error, Result};

pub const TTY: &str = "/dev/tty";

fn write_tty(text: &str) -> std::io::Result<()> {
    OpenOptions::new()
        .write(true)
        .open(TTY)?
        .write_all(text.as_bytes())
}

/// `printf ... >/dev/tty` under `set -e`.
pub fn print(text: &str) -> Result<()> {
    write_tty(text).map_err(|err| Error::io(format!("worktree: {TTY}"), err))
}

/// `printf ... >/dev/tty` inside `$(...)`, where a failure is reported and ignored.
pub fn print_or_report(text: &str) {
    if let Err(err) = print(text) {
        err.report();
    }
}

/// Outcome of `read -r -p prompt response <source`.
#[derive(Debug, PartialEq, Eq)]
pub enum Reply {
    /// The redirection failed; bash leaves the variable unchanged.
    Unopened,
    /// End of input before a newline: `read` fails but keeps the partial text.
    Eof(String),
    Line(String),
}

impl Reply {
    pub fn read(prompt: &str, source: &Path) -> Self {
        let mut file = match File::open(source) {
            Ok(file) => file,
            Err(err) => {
                Error::io(format!("worktree: {}", source.display()), err).report();
                return Self::Unopened;
            }
        };
        if file.is_terminal() {
            eprint!("{prompt}");
            let _ = std::io::stderr().flush();
        }
        // Byte at a time, so nothing past the newline is consumed.
        let mut line = Vec::new();
        let mut byte = [0_u8; 1];
        let complete = loop {
            match file.read(&mut byte) {
                Ok(1) if byte[0] == b'\n' => break true,
                Ok(1) => line.push(byte[0]),
                Ok(_) | Err(_) => break false,
            }
        };
        let text = String::from_utf8_lossy(&line)
            .trim_matches([' ', '\t'])
            .to_string();
        if complete {
            Self::Line(text)
        } else {
            Self::Eof(text)
        }
    }

    /// Update `value` the way `read` does, whether or not it succeeded.
    pub fn assign_to(self, value: &mut String) {
        match self {
            Self::Unopened => {}
            Self::Eof(text) | Self::Line(text) => *value = text,
        }
    }
}

/// `read` from /dev/tty under `set -e`.
pub fn read_line(prompt: &str) -> Result<String> {
    match Reply::read(prompt, Path::new(TTY)) {
        Reply::Line(text) => Ok(text),
        Reply::Unopened | Reply::Eof(_) => Err(Error::Status(1)),
    }
}

/// `if ! read ...; then die Cancelled; fi` followed by `case [Yy] | [Yy][Ee][Ss]`.
pub fn confirm(prompt: &str, source: &Path) -> Result<()> {
    match Reply::read(prompt, source) {
        Reply::Line(text) if is_yes(&text) => Ok(()),
        _ => Err(Error::fatal("Cancelled")),
    }
}

pub fn is_yes(text: &str) -> bool {
    text.eq_ignore_ascii_case("y") || text.eq_ignore_ascii_case("yes")
}

pub fn starts_with_yes(text: &str) -> bool {
    text.starts_with(['y', 'Y'])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yes_matching() {
        assert!(is_yes("Y") && is_yes("yEs") && !is_yes("yess") && !is_yes(""));
        assert!(starts_with_yes("yup") && !starts_with_yes("n"));
    }
}
