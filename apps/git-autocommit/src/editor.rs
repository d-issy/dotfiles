use crate::bash::{is_space, strip_command_substitution_newlines};
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;

struct TempFile(PathBuf);

impl TempFile {
    fn create(contents: &str) -> Option<Self> {
        let dir = env::temp_dir();
        (0..100).find_map(|n| {
            let path = dir.join(format!("git-auto-commit.{}.{n}", std::process::id()));
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .ok()?;
            let temp = Self(path);
            let _ = writeln!(file, "{contents}");
            Some(temp)
        })
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn editor_command() -> String {
    ["VISUAL", "EDITOR"]
        .into_iter()
        .filter_map(|name| env::var(name).ok())
        .find(|value| !value.is_empty())
        .unwrap_or_else(|| "vim".to_owned())
}

/// Returns an empty string when the user cancels (content unchanged or empty).
pub fn edit(initial: &str) -> String {
    let Some(temp) = TempFile::create(initial) else {
        return String::new();
    };

    let editor = editor_command();
    let mut words = editor.split(is_space).filter(|w| !w.is_empty());
    if let Some(program) = words.next() {
        let tty_in = OpenOptions::new().read(true).open("/dev/tty");
        let tty_out = OpenOptions::new().write(true).open("/dev/tty");
        if let (Ok(stdin), Ok(stdout)) = (tty_in, tty_out) {
            let _ = Command::new(program)
                .args(words)
                .arg(&temp.0)
                .stdin(stdin)
                .stdout(stdout)
                .status();
        }
    }

    let content = fs::read(&temp.0).unwrap_or_default();
    let content = String::from_utf8_lossy(&content);
    let result = strip_command_substitution_newlines(&content);
    if result == initial {
        String::new()
    } else {
        result.to_owned()
    }
}

/// Edits a single-line value; embedded newlines are dropped.
pub fn edit_line(initial: &str) -> String {
    edit(initial).replace('\n', "")
}
