//! Thin helpers around the `tmux` executable (resolved through PATH, which the
//! Nix wrapper pins to the configured tmux package).

use std::process::{Command, Stdio};

/// Runs tmux and returns its stdout; empty on any failure (`2>/dev/null || true`).
pub fn output(args: &[&str]) -> String {
    Command::new("tmux")
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default()
}

/// Like `$(tmux ...)`: trailing newlines are stripped.
pub fn capture(args: &[&str]) -> String {
    output(args).trim_end_matches('\n').to_string()
}

/// Runs tmux discarding all output and ignoring failure.
pub fn quiet(args: &[&str]) {
    let _ = Command::new("tmux")
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}
