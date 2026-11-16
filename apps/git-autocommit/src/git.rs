use crate::bash::strip_command_substitution_newlines;
use crate::error::{Error, Result};
use std::ffi::OsStr;
use std::process::{Command, Stdio};

const MAX_DIFF_BYTES: usize = 204_800;

fn quiet(args: &[&str]) -> Command {
    let mut command = Command::new("git");
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command
}

fn succeeds(args: &[&str]) -> bool {
    quiet(args).status().is_ok_and(|s| s.success())
}

fn output<I, S>(args: I) -> Result<Vec<u8>>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let out = Command::new("git")
        .args(args)
        .stderr(Stdio::inherit())
        .output()
        .map_err(Error::GitSpawn)?;
    if out.status.success() {
        Ok(out.stdout)
    } else {
        Err(Error::Exit(out.status.code().unwrap_or(1)))
    }
}

fn text(args: &[&str]) -> Result<String> {
    let out = output(args)?;
    Ok(strip_command_substitution_newlines(&String::from_utf8_lossy(&out)).to_owned())
}

fn run_visible(args: &[&str]) -> Result<()> {
    let status = Command::new("git")
        .args(args)
        .status()
        .map_err(|_| Error::Exit(127))?;
    if status.success() {
        Ok(())
    } else {
        Err(Error::Exit(status.code().unwrap_or(1)))
    }
}

pub fn is_inside_work_tree() -> bool {
    succeeds(&["rev-parse", "--is-inside-work-tree"])
}

pub fn current_branch() -> Result<String> {
    text(&["branch", "--show-current"])
}

pub fn staged_name_status() -> Result<String> {
    text(&["diff", "--staged", "--name-status"])
}

pub fn staged_stat() -> Result<Vec<u8>> {
    output(["diff", "--staged", "--stat"])
}

pub fn is_valid_branch_name(name: &str) -> bool {
    succeeds(&["check-ref-format", "--branch", name])
}

pub fn switch_create(name: &str) -> Result<()> {
    run_visible(&["switch", "-c", name])
}

pub fn commit(message: &str) -> Result<()> {
    run_visible(&["commit", "-m", message])
}

fn diff_args(pathspecs: &[String]) -> impl Iterator<Item = &str> {
    ["diff", "--staged", "--"]
        .into_iter()
        .chain(pathspecs.iter().map(String::as_str))
}

/// Only the text sent to the LLM is filtered and capped; the commit still contains everything staged.
pub fn staged_diff_for_llm(pathspecs: &[String]) -> Result<Vec<u8>> {
    let mut diff = output(diff_args(pathspecs))?;
    diff.truncate(MAX_DIFF_BYTES);
    let end = diff.iter().rposition(|b| *b != b'\n').map_or(0, |i| i + 1);
    diff.truncate(end);
    Ok(diff)
}

pub fn detect_main_branch() -> String {
    let head = Command::new("git")
        .args(["symbolic-ref", "refs/remotes/origin/HEAD"])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output();
    if let Ok(out) = head
        && out.status.success()
    {
        let text = String::from_utf8_lossy(&out.stdout);
        return strip_remote_head(strip_command_substitution_newlines(&text)).to_owned();
    }
    ["main", "master"]
        .into_iter()
        .find(|branch| {
            succeeds(&[
                "show-ref",
                "--verify",
                "--quiet",
                &format!("refs/heads/{branch}"),
            ])
        })
        .unwrap_or("main")
        .to_owned()
}

fn strip_remote_head(head: &str) -> &str {
    head.strip_prefix("refs/remotes/origin/").unwrap_or(head)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diff_args_append_pathspecs() {
        let specs = vec![
            ":(top)".to_owned(),
            ":(top,exclude,glob)**/*.pem".to_owned(),
        ];
        assert_eq!(
            diff_args(&specs).collect::<Vec<_>>(),
            [
                "diff",
                "--staged",
                "--",
                ":(top)",
                ":(top,exclude,glob)**/*.pem"
            ]
        );
    }

    #[test]
    fn remote_head_prefix_is_stripped() {
        assert_eq!(strip_remote_head("refs/remotes/origin/main"), "main");
        assert_eq!(strip_remote_head("refs/remotes/origin/feat/x"), "feat/x");
        assert_eq!(strip_remote_head("other"), "other");
    }
}
