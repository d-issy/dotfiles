use std::io::{self, Write};
use std::os::unix::process::ExitStatusExt;
use std::process::{Command, ExitStatus, Stdio};

use crate::error::{Error, Result};
use crate::shell::{os_error_text, strip_trailing_newlines};

#[derive(Debug, Default)]
pub struct Captured<T = String> {
    pub code: i32,
    pub stdout: T,
}

impl<T> Captured<T> {
    pub fn success(&self) -> bool {
        self.code == 0
    }
}

#[derive(Debug)]
pub struct Piped {
    pub code: i32,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
}

/// Shell-like ways of running a command. A program that cannot be started is
/// reported on stderr and treated as exit status 127, as bash does.
pub trait CommandExt {
    fn run(&mut self) -> i32;
    fn run_silently(&mut self) -> i32;
    fn run_without_stdout(&mut self) -> i32;
    fn succeeds(&mut self) -> bool;
    /// Run and stop like `set -e` would when the command fails.
    fn checked(&mut self) -> Result<()>;
    /// `$(command)`: stdout without trailing newlines, stderr shown.
    fn capture(&mut self) -> Captured;
    fn capture_bytes(&mut self) -> Captured<Vec<u8>>;
    fn stdout_text(&mut self) -> String;
    /// `x="$(command)"` under `set -e`.
    fn checked_stdout(&mut self) -> Result<String>;
    fn discard_stderr(&mut self) -> &mut Self;
    fn pipe(&mut self, input: &[u8]) -> io::Result<Piped>;
}

fn exit_code(status: ExitStatus) -> i32 {
    status
        .code()
        .unwrap_or_else(|| 128 + status.signal().unwrap_or(0))
}

fn report_spawn_failure(command: &Command, err: &io::Error) -> i32 {
    eprintln!(
        "worktree: {}: {}",
        command.get_program().to_string_lossy(),
        os_error_text(err)
    );
    127
}

impl CommandExt for Command {
    fn run(&mut self) -> i32 {
        match self.status() {
            Ok(status) => exit_code(status),
            Err(err) => report_spawn_failure(self, &err),
        }
    }

    fn run_silently(&mut self) -> i32 {
        self.stdout(Stdio::null()).stderr(Stdio::null()).run()
    }

    fn run_without_stdout(&mut self) -> i32 {
        self.stdout(Stdio::null()).run()
    }

    fn succeeds(&mut self) -> bool {
        self.run_silently() == 0
    }

    fn checked(&mut self) -> Result<()> {
        match self.run() {
            0 => Ok(()),
            code => Err(Error::Status(code)),
        }
    }

    fn capture(&mut self) -> Captured {
        let Captured { code, stdout } = self.capture_bytes();
        Captured {
            code,
            stdout: strip_trailing_newlines(&String::from_utf8_lossy(&stdout)).to_string(),
        }
    }

    fn capture_bytes(&mut self) -> Captured<Vec<u8>> {
        match self.stdout(Stdio::piped()).output() {
            Ok(output) => Captured {
                code: exit_code(output.status),
                stdout: output.stdout,
            },
            Err(err) => Captured {
                code: report_spawn_failure(self, &err),
                stdout: Vec::new(),
            },
        }
    }

    fn stdout_text(&mut self) -> String {
        self.capture().stdout
    }

    fn checked_stdout(&mut self) -> Result<String> {
        let captured = self.capture();
        if captured.success() {
            Ok(captured.stdout)
        } else {
            Err(Error::Status(captured.code))
        }
    }

    fn discard_stderr(&mut self) -> &mut Self {
        self.stderr(Stdio::null())
    }

    fn pipe(&mut self, input: &[u8]) -> io::Result<Piped> {
        self.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = self.spawn()?;
        let stdin = child.stdin.take();
        let output = std::thread::scope(|scope| {
            scope.spawn(move || {
                if let Some(mut stdin) = stdin {
                    // The reader may exit without draining stdin.
                    let _ = stdin.write_all(input);
                }
            });
            child.wait_with_output()
        })?;
        Ok(Piped {
            code: exit_code(output.status),
            stdout: output.stdout,
            stderr: output.stderr,
        })
    }
}

pub fn fuzzy_select(mut command: Command, lines: &str) -> String {
    command.stdin(Stdio::piped()).stdout(Stdio::piped());
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(err) => {
            report_spawn_failure(&command, &err);
            return String::new();
        }
    };
    let stdin = child.stdin.take();
    let output = std::thread::scope(|scope| {
        scope.spawn(move || {
            if let Some(mut stdin) = stdin {
                let _ = stdin.write_all(lines.as_bytes());
            }
        });
        child.wait_with_output()
    });
    output
        .map(|output| strip_trailing_newlines(&String::from_utf8_lossy(&output.stdout)).to_string())
        .unwrap_or_default()
}
