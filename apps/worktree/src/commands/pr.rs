use crate::context::Context;
use crate::error::{Error, Result};
use crate::process::CommandExt;
use crate::shell::{bash_split_first_tab, pipe_lines};
use crate::tty;
use crate::ui::warn;

/// The PR number picked in the fuzzy finder; empty when cancelled.
pub fn select_number(ctx: &Context) -> String {
    let list = ctx
        .gh([
            "pr",
            "list",
            "--limit",
            "100",
            "--json",
            "number,title,headRefName",
            "--jq",
            r##".[] | "#\(.number)\t\(.title)\t\(.headRefName)""##,
        ])
        .stdout_text();
    let lines: Vec<&str> = list.lines().collect();
    let selection = ctx.fuzzy_select(&pipe_lines(&lines), "Pull requests", "1,2,3");
    if selection.is_empty() {
        return selection;
    }
    let first = bash_split_first_tab(&selection).0;
    first.strip_prefix('#').unwrap_or(first).to_string()
}

struct PrWorktree<'a> {
    ctx: &'a Context,
    number: &'a str,
    path: String,
    window: String,
    temp_ref: String,
}

/// Open the worktree for a GitHub PR, creating or fast-forwarding it while
/// never discarding local commits and only discarding local changes on request.
pub fn open_worktree(ctx: &Context, number: &str) -> Result<()> {
    ctx.require_git_repo()?;
    let pr = PrWorktree {
        ctx,
        number,
        path: ctx.sibling_path_for_pr(number),
        window: format!("pr-{number}"),
        temp_ref: format!("refs/worktree-pr/{number}"),
    };
    let branch = ctx
        .gh([
            "pr",
            "view",
            number,
            "--json",
            "headRefName",
            "--jq",
            ".headRefName",
        ])
        .checked_stdout()?;
    if branch.is_empty() || branch == "null" {
        return Err(Error::fatal(format!(
            "Could not resolve PR branch for #{number}"
        )));
    }
    let git_marker = ctx.resolve(format!("{}/.git", pr.path));
    if git_marker.is_dir() || git_marker.is_file() {
        pr.refresh()
    } else {
        pr.create(branch)
    }
}

impl PrWorktree<'_> {
    fn fetch(&self) -> bool {
        self.ctx
            .git([
                "fetch",
                "--no-prune",
                "origin",
                &format!("+refs/pull/{}/head:{}", self.number, self.temp_ref),
            ])
            .run()
            == 0
            && self
                .ctx
                .git(["show-ref", "--verify", "--quiet", &self.temp_ref])
                .succeeds()
    }

    fn delete_temp_ref(&self) -> Result<()> {
        self.ctx.git(["update-ref", "-d", &self.temp_ref]).checked()
    }

    fn open(&self, path: &str) -> Result<()> {
        self.ctx.open_path(path, &self.window)
    }

    fn create(&self, mut branch: String) -> Result<()> {
        let ctx = self.ctx;
        if ctx.exists(&self.path) {
            return Err(Error::fatal(format!("Path already exists: {}", self.path)));
        }
        if !self.fetch() {
            return Err(Error::fatal(format!("Could not fetch PR #{}", self.number)));
        }
        if ctx.branch_exists(&branch) {
            branch = format!("worktree/pr-{}", self.number);
        }
        if ctx.branch_exists(&branch) {
            if let Some(existing) = ctx.branch_checked_out_path(&branch) {
                warn(&format!("PR branch is already checked out at: {existing}"));
                self.delete_temp_ref()?;
                ctx.save_window(&branch, &self.window)?;
                return self.open(&existing);
            }
            if ctx
                .git(["merge-base", "--is-ancestor", &branch, &self.temp_ref])
                .run()
                != 0
            {
                return Err(Error::fatal(format!(
                    "Local branch {branch} has commits outside the fetched PR head; preserving it. Rename it before retrying."
                )));
            }
            ctx.git(["branch", "-f", &branch, &self.temp_ref])
                .checked()?;
        } else {
            ctx.git(["branch", &branch, &self.temp_ref]).checked()?;
        }
        self.delete_temp_ref()?;
        ctx.git(["worktree", "add", &self.path, &branch])
            .checked()?;
        ctx.save_window(&branch, &self.window)?;
        self.open(&self.path)
    }

    fn refresh(&self) -> Result<()> {
        let ctx = self.ctx;
        let path = self.path.as_str();
        if !self.fetch() {
            warn(&format!(
                "Could not update PR #{}; switching only.",
                self.number
            ));
            return self.open(path);
        }
        if ctx
            .git([
                "-C",
                path,
                "merge-base",
                "--is-ancestor",
                "HEAD",
                &self.temp_ref,
            ])
            .run()
            != 0
        {
            warn(
                "PR worktree has commits outside the fetched PR head; preserving them and switching only.",
            );
            self.delete_temp_ref()?;
            return self.open(path);
        }
        let keep_local_changes = ctx.has_local_changes(path) && !self.discard_local_changes()?;
        if !keep_local_changes {
            ctx.git(["-C", path, "reset", "--hard", &self.temp_ref])
                .checked()?;
        }
        self.delete_temp_ref()?;
        let branch = ctx
            .git(["-C", path, "branch", "--show-current"])
            .checked_stdout()?;
        ctx.save_window(&branch, &self.window)?;
        self.open(path)
    }

    fn discard_local_changes(&self) -> Result<bool> {
        let path = self.path.as_str();
        tty::print("PR worktree has local changes.\n")?;
        if tty::starts_with_yes(&tty::read_line(
            "Force update and discard local changes? [y/N] ",
        )?) {
            self.ctx.git(["-C", path, "reset", "--hard"]).checked()?;
            self.ctx.git(["-C", path, "clean", "-fd"]).checked()?;
            Ok(true)
        } else {
            warn("Skipping update; switching only.");
            Ok(false)
        }
    }
}
