use crate::context::Context;
use crate::error::Result;
use crate::names::{pr_number_suffix, short_window_from_branch};
use crate::process::CommandExt;
use crate::shell::basename;
use crate::ui::Color;

const KEY_SUFFIX: &str = ".worktree-window";

fn window_key(branch: &str) -> String {
    format!("branch.{branch}{KEY_SUFFIX}")
}

fn legacy_window_key(branch: &str) -> String {
    format!("branch.\"{branch}\"{KEY_SUFFIX}")
}

/// awk `$1 ~ /^branch\..*\.worktree-window$/`
fn is_window_key(key: &str) -> bool {
    key.len() >= "branch.".len() + KEY_SUFFIX.len()
        && key.starts_with("branch.")
        && key.ends_with(KEY_SUFFIX)
}

fn branch_from_window_key(key: &str) -> &str {
    let branch = key.strip_prefix("branch.").unwrap_or(key);
    let branch = branch.strip_suffix(KEY_SUFFIX).unwrap_or(branch);
    let branch = branch.strip_prefix('"').unwrap_or(branch);
    branch.strip_suffix('"').unwrap_or(branch)
}

impl Context {
    pub fn saved_window(&self, branch: Option<&str>) -> Option<String> {
        let branch = branch.filter(|branch| !branch.is_empty())?;
        [window_key(branch), legacy_window_key(branch)]
            .iter()
            .map(|key| self.config_value(key))
            .find(|window| !window.is_empty())
    }

    pub fn save_window(&self, branch: &str, window: &str) -> Result<()> {
        if branch.is_empty() || window.is_empty() {
            return Ok(());
        }
        self.git(["config", &window_key(branch), window])
            .checked()?;
        self.git(["config", "--unset-all", &legacy_window_key(branch)])
            .run_silently();
        Ok(())
    }

    pub fn forget_window(&self, branch: &str) {
        if branch.is_empty() {
            return;
        }
        for key in [window_key(branch), legacy_window_key(branch)] {
            self.git(["config", "--unset-all", &key]).run_silently();
        }
    }

    pub fn cleanup_stale_saved_windows(&self) {
        let listing = self
            .git(["config", "--get-regexp", "worktree-window$"])
            .discard_stderr()
            .stdout_text();
        let stale = listing
            .lines()
            .filter_map(|line| line.split_whitespace().next())
            .filter(|key| is_window_key(key))
            .filter(|key| !self.branch_exists(branch_from_window_key(key)));
        for key in stale {
            let branch = branch_from_window_key(key);
            for section in [format!("branch.{branch}"), format!("branch.\"{branch}\"")] {
                self.git(["config", "--remove-section", &section])
                    .run_silently();
            }
            self.git(["config", "--unset-all", key]).run_silently();
            println!(
                "{} stale window config: {key}",
                Color::Green.paint("Cleaned:")
            );
        }
    }

    /// The saved window name, else `pr-<n>` for PR worktrees, else one derived
    /// from the branch (or the directory when detached).
    pub fn desired_window(&self, path: &str, branch: Option<&str>) -> String {
        if let Some(window) = self.saved_window(branch) {
            return window;
        }
        let base = basename(path);
        if let Some(number) = pr_number_suffix(base) {
            return format!("pr-{number}");
        }
        match branch.filter(|branch| !branch.is_empty()) {
            Some(branch) => short_window_from_branch(branch),
            None => short_window_from_branch(base),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn window_keys_round_trip() {
        assert_eq!(branch_from_window_key("branch.a/b.worktree-window"), "a/b");
        assert_eq!(branch_from_window_key("branch.\"x\".worktree-window"), "x");
        assert!(is_window_key("branch..worktree-window"));
        assert!(!is_window_key("branch.worktree-window"));
    }
}
