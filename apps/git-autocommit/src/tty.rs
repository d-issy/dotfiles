use crate::bash::is_space;
use crate::error::{Error, Result};
use std::fs::{File, OpenOptions};
use std::io::{Read, Write};

#[derive(Debug, PartialEq)]
pub enum Answer {
    Yes,
    No,
    Edit,
    Regenerate,
    Other,
}

impl Answer {
    fn parse(response: &str) -> Self {
        match response.chars().next() {
            Some('Y' | 'y') => Self::Yes,
            Some('N' | 'n') => Self::No,
            Some('E' | 'e') => Self::Edit,
            Some('R' | 'r') => Self::Regenerate,
            _ => Self::Other,
        }
    }
}

#[derive(Default)]
pub struct Tty {
    file: Option<File>,
}

impl Tty {
    /// Prompts on stderr and reads a trimmed line; end of input is fatal.
    fn read_line(&mut self, prompt: &str) -> Result<String> {
        let file = match &mut self.file {
            Some(file) => file,
            None => self.file.insert(
                OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open("/dev/tty")
                    .map_err(Error::Tty)?,
            ),
        };
        eprint!("{prompt}");
        let _ = std::io::stderr().flush();
        let mut line = Vec::new();
        loop {
            let mut byte = [0u8; 1];
            file.read_exact(&mut byte).map_err(|_| Error::Exit(1))?;
            if byte[0] == b'\n' {
                return Ok(String::from_utf8_lossy(&line)
                    .trim_matches(is_space)
                    .to_owned());
            }
            line.push(byte[0]);
        }
    }

    /// An empty response means yes.
    pub fn confirm(&mut self, prompt: &str) -> Result<Answer> {
        let response = self.read_line(prompt)?;
        Ok(if response.is_empty() {
            Answer::Yes
        } else {
            Answer::parse(&response)
        })
    }

    pub fn choose(&mut self, prompt: &str) -> Result<Answer> {
        Ok(Answer::parse(&self.read_line(prompt)?))
    }

    pub fn instruction(&mut self) -> Result<String> {
        self.read_line("Instruction (Enter to skip): ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_are_prefix_based() {
        assert_eq!(Answer::parse("yes"), Answer::Yes);
        assert_eq!(Answer::parse("Re"), Answer::Regenerate);
        assert_eq!(Answer::parse("x"), Answer::Other);
        assert_eq!(Answer::parse(""), Answer::Other);
        assert_eq!(Answer::parse("No"), Answer::No);
    }
}
