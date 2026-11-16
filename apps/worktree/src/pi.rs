use std::io::Write;
use std::os::unix::fs::PermissionsExt;

use serde_json::Value;

use crate::context::Context;
use crate::error::{Error, Result};
use crate::names::Names;
use crate::process::CommandExt;
use crate::shell::{os_error_text, strip_trailing_newlines};
use crate::tty::{self, Reply};
use crate::ui::Color;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Staged changes, for `create`.
    Staged,
    /// Working tree and index changes, for `rename`.
    Current,
}

impl Mode {
    fn action(self) -> &'static str {
        match self {
            Self::Staged => "Create",
            Self::Current => "Rename",
        }
    }
}

const RULES: &str = r#"Return ONLY compact JSON with this shape:
{"branch":"kebab-case-branch-name","window":"short-window-name"}

Rules:
- branch must be a valid git branch name suitable for a PR.
- Do not add generic prefixes like feature/, fix/, worktree/ unless the project diff clearly indicates that convention.
- branch: kebab-case, descriptive, preferably 2-5 words.
- window: short for tmux status, kebab-case, preferably 1-3 words and under 18 chars.
- No markdown, no explanation."#;

const DIFF_LIMIT_CHARS: usize = 204_800;

const PI_FLAGS: [&str; 6] = [
    "--no-session",
    "--no-tools",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-context-files",
];

impl Context {
    /// A diff for naming only: secret and noise paths excluded, size capped.
    fn naming_diff(&self, args: &[&str]) -> String {
        let out = self
            .git(["diff"])
            .args(args)
            .arg("--")
            .args(&self.config.diff_pathspecs)
            .discard_stderr()
            .stdout_text();
        let capped: String = out.chars().take(DIFF_LIMIT_CHARS).collect();
        format!("{capped}\n")
    }

    pub fn naming_prompt(&self, mode: Mode) -> String {
        match mode {
            Mode::Staged => format!(
                "Generate names for a git worktree task from the staged changes.\n\n{RULES}\n\nStaged changes:\n\n{}\n{}",
                self.naming_diff(&["--cached", "--stat"]),
                self.naming_diff(&["--cached"]),
            ),
            Mode::Current => format!(
                "Generate a new git branch name and short tmux window name from the current repository changes.\n\n{RULES}\n\nCurrent changes:\n\n{}\n{}\n{}\n{}",
                self.naming_diff(&["--stat", "HEAD"]),
                self.naming_diff(&["HEAD"]),
                self.naming_diff(&["--cached", "--stat"]),
                self.naming_diff(&["--cached"]),
            ),
        }
    }

    /// Pi's answer; on failure its stderr is shown and the answer is empty.
    fn ask_pi(&self, prompt: &str) -> String {
        if !on_path("pi") {
            Error::fatal("pi CLI not found").report();
            return String::new();
        }
        let mut command = self.command("pi");
        command.arg("--print");
        if let Some(model) = &self.config.model {
            command.args(["--model", model]);
        }
        if let Some(thinking) = &self.config.thinking {
            command.args(["--thinking", thinking]);
        }
        match command.args(PI_FLAGS).pipe(prompt.as_bytes()) {
            Ok(piped) if piped.code == 0 => {
                strip_trailing_newlines(&String::from_utf8_lossy(&piped.stdout)).to_string()
            }
            Ok(piped) => {
                let _ = std::io::stderr().write_all(&piped.stderr);
                String::new()
            }
            Err(err) => {
                eprintln!("worktree: pi: {}", os_error_text(&err));
                String::new()
            }
        }
    }

    pub fn generate_names(&self, mode: Mode) -> Result<Names> {
        let output = self.ask_pi(&self.naming_prompt(mode));
        let branch = jq_raw_field(&output, "branch");
        let window = jq_raw_field(&output, "window");
        if branch.is_empty() || window.is_empty() {
            return Err(Error::fatal(format!(
                "Could not parse generated names from Pi output: {output}"
            )));
        }
        Ok(Names::from_tab_pair(&format!("{branch}\t{window}")))
    }

    pub fn confirm_names(&self, mode: Mode, mut names: Names) -> Result<Names> {
        let mut response = String::new();
        let mut edited_branch = String::new();
        let mut edited_window = String::new();
        loop {
            tty::print_or_report(&format!(
                "\n{} {}\n",
                Color::Blue.paint("Branch:"),
                names.branch
            ));
            tty::print_or_report(&format!(
                "{} {}\n\n",
                Color::Blue.paint("Window:"),
                names.window
            ));
            Reply::read(&format!("{}? [Y/n/e/r] ", mode.action()), tty::TTY.as_ref())
                .assign_to(&mut response);
            if response.is_empty() {
                response = "Y".into();
            }
            match response.chars().next() {
                Some('Y' | 'y') => return Ok(names),
                Some('N' | 'n') => return Err(Error::fatal("Cancelled")),
                Some('E' | 'e') => {
                    Reply::read(&format!("Branch [{}]: ", names.branch), tty::TTY.as_ref())
                        .assign_to(&mut edited_branch);
                    Reply::read(&format!("Window [{}]: ", names.window), tty::TTY.as_ref())
                        .assign_to(&mut edited_window);
                    if !edited_branch.is_empty() {
                        names.branch.clone_from(&edited_branch);
                    }
                    if !edited_window.is_empty() {
                        names.window.clone_from(&edited_window);
                    }
                }
                Some('R' | 'r') => {
                    names = self.generate_names(mode).unwrap_or_else(|err| {
                        err.report();
                        Names::default()
                    });
                }
                _ => tty::print_or_report("Please answer Y, n, e, or r.\n"),
            }
        }
    }
}

fn on_path(program: &str) -> bool {
    std::env::var_os("PATH").is_some_and(|paths| {
        std::env::split_paths(&paths).any(|dir| {
            std::fs::metadata(dir.join(program))
                .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
        })
    })
}

/// What `jq -r '.<key>'` prints for each JSON value in `text`, up to the first
/// error; the shell version ignored jq's exit status and kept the output.
pub fn jq_raw_field(text: &str, key: &str) -> String {
    let mut lines = Vec::new();
    for value in serde_json::Deserializer::from_str(text).into_iter::<Value>() {
        let field = match value {
            Ok(Value::Object(mut map)) => map.remove(key).unwrap_or_default(),
            Ok(Value::Null) => Value::Null,
            _ => break,
        };
        lines.push(match field {
            Value::String(text) => text,
            other => serde_json::to_string_pretty(&other).unwrap_or_default(),
        });
    }
    strip_trailing_newlines(&lines.join("\n")).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jq_raw_field_matches_jq() {
        assert_eq!(
            jq_raw_field(r#"{"branch":"a-b","window":"w"}"#, "branch"),
            "a-b"
        );
        assert_eq!(jq_raw_field(r#"{"window":"w"}"#, "branch"), "null");
        assert_eq!(jq_raw_field("not json", "branch"), "");
        assert_eq!(jq_raw_field(r#""text""#, "branch"), "");
        assert_eq!(jq_raw_field("", "branch"), "");
        assert_eq!(jq_raw_field(r#"{"branch":1}"#, "branch"), "1");
    }
}
