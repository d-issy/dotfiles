use crate::context::Context;
use crate::error::{Error, Result};
use crate::names::sanitize_path_component;
use crate::process::CommandExt;
use crate::shell::{basename, dirname, strip_trailing_newlines};

impl Context {
    pub fn require_git_repo(&self) -> Result<()> {
        if self.git(["rev-parse", "--is-inside-work-tree"]).succeeds() {
            Ok(())
        } else {
            Err(Error::fatal("Not in a git repository"))
        }
    }

    pub fn repo_root(&self) -> String {
        self.git(["rev-parse", "--show-toplevel"]).stdout_text()
    }

    pub fn common_git_dir(&self) -> String {
        self.git(["rev-parse", "--path-format=absolute", "--git-common-dir"])
            .stdout_text()
    }

    pub fn current_branch(&self) -> String {
        self.git(["branch", "--show-current"]).stdout_text()
    }

    /// The main checkout: the parent of a `.git` common dir, else the repo root.
    pub fn managed_repo_root(&self) -> String {
        let common = self.common_git_dir();
        if basename(&common) == ".git" {
            dirname(&common).to_string()
        } else {
            self.repo_root()
        }
    }

    pub fn is_main_checkout_path(&self, path: &str) -> bool {
        self.realpath(path) == self.realpath(&self.managed_repo_root())
    }

    /// `git hash-object --stdin <<<"$text"`; the here-string appends a newline.
    pub fn hash_text(&self, text: &str) -> String {
        match self
            .git(["hash-object", "--stdin"])
            .pipe(format!("{text}\n").as_bytes())
        {
            Ok(piped) => {
                eprint!("{}", String::from_utf8_lossy(&piped.stderr));
                strip_trailing_newlines(&String::from_utf8_lossy(&piped.stdout)).to_string()
            }
            Err(_) => String::new(),
        }
    }

    fn sibling_path(&self, suffix: &str) -> String {
        let root = self.managed_repo_root();
        format!("{}/{}.{suffix}", dirname(&root), basename(&root))
    }

    pub fn sibling_path_for_branch(&self, branch: &str) -> String {
        self.sibling_path(&sanitize_path_component(branch))
    }

    pub fn sibling_path_for_pr(&self, number: &str) -> String {
        self.sibling_path(&format!("pr-{number}"))
    }

    pub fn config_value(&self, key: &str) -> String {
        self.git(["config", "--get", key])
            .discard_stderr()
            .stdout_text()
    }

    pub fn branch_exists(&self, branch: &str) -> bool {
        self.git([
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{branch}"),
        ])
        .succeeds()
    }

    pub fn commit_of(&self, rev: &str) -> String {
        self.git(["rev-parse", "--verify", &format!("{rev}^{{commit}}")])
            .discard_stderr()
            .stdout_text()
    }

    pub fn validate_new_branch_and_path(&self, branch: &str, path: &str) -> Result<()> {
        if self
            .git(["check-ref-format", "--branch", branch])
            .run_without_stdout()
            != 0
        {
            return Err(Error::fatal(format!("Invalid branch name: {branch}")));
        }
        if self.branch_exists(branch) {
            return Err(Error::fatal(format!("Branch already exists: {branch}")));
        }
        if self.exists(path) {
            return Err(Error::fatal(format!("Path already exists: {path}")));
        }
        Ok(())
    }

    fn origin_head(&self) -> String {
        self.git([
            "symbolic-ref",
            "--quiet",
            "--short",
            "refs/remotes/origin/HEAD",
        ])
        .discard_stderr()
        .stdout_text()
    }

    /// origin/HEAD, then the current branch's upstream, then HEAD.
    pub fn default_base_ref(&self) -> String {
        let origin = self.origin_head();
        if !origin.is_empty() {
            return origin;
        }
        if !self.current_branch().is_empty() {
            let upstream = self
                .git([
                    "rev-parse",
                    "--abbrev-ref",
                    "--symbolic-full-name",
                    "@{upstream}",
                ])
                .discard_stderr()
                .stdout_text();
            if !upstream.is_empty() {
                return upstream;
            }
        }
        "HEAD".into()
    }

    pub fn default_branch_name(&self) -> String {
        let origin = self.origin_head();
        if !origin.is_empty() {
            return origin
                .strip_prefix("origin/")
                .unwrap_or(&origin)
                .to_string();
        }
        if let Some(name) = ["main", "master"]
            .into_iter()
            .find(|name| self.branch_exists(name))
        {
            return name.into();
        }
        let root = self.managed_repo_root();
        let root_branch = self
            .git(["-C", &root, "branch", "--show-current"])
            .discard_stderr()
            .stdout_text();
        if root_branch.is_empty() {
            self.current_branch()
        } else {
            root_branch
        }
    }

    pub fn has_local_changes(&self, path: &str) -> bool {
        !self
            .git(["-C", path, "status", "--porcelain"])
            .stdout_text()
            .is_empty()
    }

    /// `git worktree add -b`, recording the starting commit so prune can tell
    /// a branch nobody committed to from a merged one even after reflog expiry.
    pub fn add_worktree_branch(&self, branch: &str, target: &str, base: &str) -> Result<()> {
        self.git(["worktree", "add", "-b", branch, target, base])
            .checked()?;
        let tip = self
            .git([
                "rev-parse",
                "--verify",
                &format!("refs/heads/{branch}^{{commit}}"),
            ])
            .stdout_text();
        self.git(["config", &format!("branch.{branch}.worktreeBase"), &tip])
            .checked()
    }
}
