use crate::bash::strip_command_substitution_newlines;
use crate::error::{Error, Result};
use std::io::Write;
use std::process::{Command, Stdio};

/// Runs pi with the prompt on stdin and returns its stdout.
pub fn run(args: &[String], prompt: Vec<u8>) -> Result<String> {
    let mut child = Command::new("pi")
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(Error::PiSpawn)?;
    let stdin = child.stdin.take();
    // A writer thread keeps a pi that stops reading early from deadlocking the output capture.
    let writer = std::thread::spawn(move || {
        if let Some(mut stdin) = stdin {
            let _ = stdin.write_all(&prompt);
        }
    });
    let out = child.wait_with_output().map_err(|_| Error::Exit(1))?;
    let _ = writer.join();
    if !out.status.success() {
        return Err(Error::PiFailed(out.stderr));
    }
    Ok(strip_command_substitution_newlines(&String::from_utf8_lossy(&out.stdout)).to_owned())
}
