use dot::shell::strip_trailing_newlines;
use std::process::{Command, Stdio};

pub fn output(args: &[&str]) -> String {
    Command::new("tmux")
        .args(args)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
        .unwrap_or_default()
}

/// Shell command-substitution semantics: trailing newlines are dropped.
pub fn capture(args: &[&str]) -> String {
    strip_trailing_newlines(&output(args)).to_string()
}

pub fn quiet(args: &[&str]) {
    let _ = Command::new("tmux")
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

pub fn refresh_status() {
    quiet(&["refresh-client", "-S"]);
}

pub fn list_panes(args: &[&str]) -> Vec<String> {
    let mut full = vec!["list-panes"];
    full.extend_from_slice(args);
    full.extend_from_slice(&["-F", "#{pane_id}"]);
    output(&full).lines().map(str::to_string).collect()
}

pub struct Pane<'a>(pub &'a str);

impl Pane<'_> {
    pub fn option(&self, name: &str) -> String {
        capture(&["show-option", "-p", "-t", self.0, "-v", name])
    }

    pub fn set_option(&self, name: &str, value: &str) {
        quiet(&["set-option", "-p", "-t", self.0, name, value]);
    }

    pub fn title(&self) -> String {
        capture(&["display-message", "-p", "-t", self.0, "#{pane_title}"])
    }

    pub fn set_title(&self, title: &str) {
        quiet(&["select-pane", "-t", self.0, "-T", title]);
    }

    pub fn display(&self, format: &str) -> String {
        capture(&["display-message", "-p", "-t", self.0, format])
    }
}
