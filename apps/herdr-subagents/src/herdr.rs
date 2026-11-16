use crate::error::{Error, Result};
use std::ffi::OsStr;
use std::os::unix::process::ExitStatusExt;
use std::process::{Command, ExitStatus, Stdio};

#[derive(Clone)]
pub struct Herdr {
    bin: String,
}

pub struct Output {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

impl Output {
    pub fn combined(&self) -> String {
        format!("{}{}", self.stdout, self.stderr)
    }
}

pub fn exit_code(status: ExitStatus) -> i32 {
    status
        .code()
        .or_else(|| status.signal().map(|signal| 128 + signal))
        .unwrap_or(1)
}

pub fn trim_newlines(text: &str) -> &str {
    text.trim_end_matches('\n')
}

/// Runs a program like `$(...)` does: stderr passes through, stdout is returned without trailing newlines.
pub fn capture_stdout<S: AsRef<OsStr>>(program: &str, args: &[S]) -> Result<String> {
    let output = Command::new(program)
        .args(args)
        .stderr(Stdio::inherit())
        .output()
        .map_err(|source| Error::Spawn {
            program: program.to_string(),
            source,
        })?;
    if !output.status.success() {
        return Err(Error::Exit(exit_code(output.status)));
    }
    Ok(trim_newlines(&String::from_utf8_lossy(&output.stdout)).to_string())
}

impl Herdr {
    pub fn new(bin: String) -> Self {
        Self { bin }
    }

    pub fn capture<S: AsRef<OsStr>>(&self, args: &[S]) -> Result<String> {
        capture_stdout(&self.bin, args)
    }

    pub fn run<S: AsRef<OsStr>>(&self, args: &[S]) -> Output {
        match Command::new(&self.bin).args(args).output() {
            Ok(output) => Output {
                success: output.status.success(),
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            },
            Err(error) => Output {
                success: false,
                stdout: String::new(),
                stderr: format!("{}: {error}\n", self.bin),
            },
        }
    }

    pub fn close_pane_quietly(&self, pane: &str) {
        let _ = Command::new(&self.bin)
            .args(["pane", "close", pane])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}
