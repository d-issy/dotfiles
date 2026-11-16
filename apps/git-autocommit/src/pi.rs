use crate::bash::strip_command_substitution_newlines;
use crate::error::{Error, Result};
use dot::process::wait_with_input;
use std::process::{Command, Stdio};

/// Runs pi with the prompt on stdin and returns its stdout.
pub fn run(args: &[String], prompt: Vec<u8>) -> Result<String> {
    let child = Command::new("pi")
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(Error::PiSpawn)?;
    let out = wait_with_input(child, &prompt).map_err(|_| Error::Exit(1))?;
    if !out.status.success() {
        return Err(Error::PiFailed(out.stderr));
    }
    Ok(strip_command_substitution_newlines(&String::from_utf8_lossy(&out.stdout)).to_owned())
}
