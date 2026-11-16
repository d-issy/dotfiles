use std::fmt::{self, Write};
use std::path::Path;
use std::sync::mpsc;

use crate::context::Context;
use crate::error::{Error, Result};
use crate::help;
use crate::process::CommandExt;
use crate::table::{self, awk_tab_columns};
use crate::tty;
use crate::ui::{Color, warn, warning_line};

const PARALLEL_REMOVALS: usize = 4;

#[derive(Debug, Default, PartialEq, Eq)]
struct Args {
    force: bool,
    yes: bool,
}

impl Args {
    /// None when help was requested.
    fn parse(args: &[String]) -> Result<Option<Self>> {
        let mut parsed = Self::default();
        for arg in args {
            match arg.as_str() {
                "-h" | "--help" => return Ok(None),
                "-f" | "--force" => parsed.force = true,
                "-y" | "--yes" => parsed.yes = true,
                other => return Err(Error::fatal(format!("Unknown prune option: {other}"))),
            }
        }
        Ok(Some(parsed))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    pub branch: String,
    pub worktree: Option<String>,
    pub dirty: bool,
    pub window: Option<String>,
}

impl Target {
    fn tsv_line(&self) -> String {
        format!(
            "{}\t{}\t{}\t{}",
            self.branch,
            self.worktree.as_deref().unwrap_or("-"),
            if self.dirty { "yes" } else { "no" },
            self.window.as_deref().unwrap_or("-")
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkipReason {
    CurrentWorktree,
    MainCheckout,
    LockedWorktree,
    DirtyWorktree,
}

impl fmt::Display for SkipReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::CurrentWorktree => "current worktree",
            Self::MainCheckout => "main checkout",
            Self::LockedWorktree => "locked worktree",
            Self::DirtyWorktree => "dirty worktree",
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skipped {
    pub branch: String,
    pub reason: SkipReason,
    pub worktree: String,
}

impl Skipped {
    fn tsv_line(&self) -> String {
        format!("{}\t{}\t{}", self.branch, self.reason, self.worktree)
    }
}

pub fn run(ctx: &Context, args: &[String]) -> Result<()> {
    ctx.require_git_repo()?;
    let Some(args) = Args::parse(args)? else {
        print!("{}", help::PRUNE);
        return Ok(());
    };

    let base = ctx.default_base_ref();
    if !ctx
        .git([
            "rev-parse",
            "--verify",
            "--quiet",
            &format!("{base}^{{commit}}"),
        ])
        .succeeds()
    {
        return Err(Error::fatal(format!(
            "Could not resolve prune base: {base}"
        )));
    }
    let (targets, skipped) = collect(ctx, &base, args.force);

    println!("Base: {base}");
    if !targets.is_empty() {
        println!("\nPrune targets:");
        let rows: Vec<[String; 4]> = targets
            .iter()
            .map(|target| awk_tab_columns(&target.tsv_line()))
            .collect();
        print!(
            "{}",
            table::render(["Branch", "Worktree", "Dirty", "Window"], &rows)
        );
    }
    if !skipped.is_empty() {
        println!("\nSkipped:");
        let rows: Vec<[String; 3]> = skipped
            .iter()
            .map(|skip| awk_tab_columns(&skip.tsv_line()))
            .collect();
        print!("{}", table::render(["Branch", "Reason", "Worktree"], &rows));
    }
    ctx.cleanup_stale_saved_windows();
    if targets.is_empty() {
        println!("\nNothing to prune.");
        return Ok(());
    }
    if !args.yes {
        println!();
        let answers = std::env::var("WORKTREE_TTY")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| tty::TTY.into());
        tty::confirm(
            &format!("Prune {} branch(es)? [y/N] ", targets.len()),
            Path::new(&answers),
        )?;
    }
    if prune(ctx, &targets, args.force) {
        Ok(())
    } else {
        Err(Error::Status(1))
    }
}

pub fn collect(ctx: &Context, base: &str, force: bool) -> (Vec<Target>, Vec<Skipped>) {
    let default_branch = ctx.default_branch_name();
    let current_key = ctx.realpath(&ctx.repo_root());
    let main_key = ctx.realpath(&ctx.managed_repo_root());
    let mut targets = Vec::new();
    let mut skipped = Vec::new();

    for branch in ctx.merged_branches(base) {
        if branch == default_branch {
            continue;
        }
        let Some(path) = ctx.branch_checked_out_path(&branch) else {
            targets.push(Target {
                branch,
                worktree: None,
                dirty: false,
                window: None,
            });
            continue;
        };
        let path_key = ctx.realpath(&path);
        let reason = if path_key == current_key {
            Some(SkipReason::CurrentWorktree)
        } else if path_key == main_key {
            Some(SkipReason::MainCheckout)
        } else if ctx.worktree_locked(&path) {
            Some(SkipReason::LockedWorktree)
        } else {
            None
        };
        if let Some(reason) = reason {
            skipped.push(Skipped {
                branch,
                reason,
                worktree: path,
            });
            continue;
        }
        let dirty = ctx.has_local_changes(&path);
        if dirty && !force {
            skipped.push(Skipped {
                branch,
                reason: SkipReason::DirtyWorktree,
                worktree: path,
            });
            continue;
        }
        let window = ctx
            .window_name_for_path(&path)
            .filter(|name| !name.is_empty());
        targets.push(Target {
            branch,
            worktree: Some(path),
            dirty,
            window,
        });
    }
    (targets, skipped)
}

/// Remove a prune target's worktree, collecting git's output in `log`. A
/// single `--force` honours worktree locks; never escalate past git's refusal.
pub fn remove_worktree(ctx: &Context, path: &str, force: bool, log: &mut Vec<u8>) -> bool {
    let mut command = ctx.git(["worktree", "remove"]);
    if force {
        command.arg("--force");
    }
    let removed = match command.arg(path).output() {
        Ok(output) => {
            log.extend_from_slice(&output.stdout);
            log.extend_from_slice(&output.stderr);
            output.status.success()
        }
        Err(err) => {
            log.extend_from_slice(
                format!("worktree: git: {}\n", crate::shell::os_error_text(&err)).as_bytes(),
            );
            false
        }
    };
    if removed && ctx.exists_or_symlink(path) {
        log.extend_from_slice(
            format!(
                "{}\n",
                warning_line(&format!(
                    "git worktree remove left the path behind; preserving it: {path}"
                ))
            )
            .as_bytes(),
        );
        return false;
    }
    removed
}

/// Remove worktrees up to four at a time; branch deletion and output stay
/// serial, in completion order. False when anything failed.
fn prune(ctx: &Context, targets: &[Target], force: bool) -> bool {
    let (sender, receiver) = mpsc::channel::<(usize, bool, Vec<u8>)>();
    let mut failed = false;
    std::thread::scope(|scope| {
        let mut pending = targets.iter().enumerate();
        let mut active = 0;
        loop {
            while active < PARALLEL_REMOVALS {
                let Some((index, target)) = pending.next() else {
                    break;
                };
                let sender = sender.clone();
                scope.spawn(move || {
                    let mut log = Vec::new();
                    let removed = target
                        .worktree
                        .as_deref()
                        .is_none_or(|path| remove_worktree(ctx, path, force, &mut log));
                    let _ = sender.send((index, removed, log));
                });
                active += 1;
            }
            if active == 0 {
                break;
            }
            let Ok((index, removed, log)) = receiver.recv() else {
                break;
            };
            active -= 1;
            eprint!("{}", String::from_utf8_lossy(&log));
            if !finish(ctx, &targets[index], removed) {
                failed = true;
            }
        }
    });
    !failed
}

fn finish(ctx: &Context, target: &Target, removed: bool) -> bool {
    let branch = target.branch.as_str();
    if !removed {
        warn(&format!(
            "Could not remove worktree for {branch}: {}",
            target.worktree.as_deref().unwrap_or("-")
        ));
        return false;
    }
    let mut cleaned = String::from("branch");
    if let Some(path) = &target.worktree {
        ctx.remove_pending_state_for(path);
        ctx.close_window_for_deleted_path(path, &ctx.managed_repo_root());
        let _ = write!(cleaned, ", worktree: {path}");
    }
    if ctx.git(["branch", "-D", branch]).run_without_stdout() != 0 {
        warn(&format!("Could not delete branch: {branch}"));
        return false;
    }
    ctx.forget_window(branch);
    if let Some(window) = &target.window {
        let _ = write!(cleaned, ", window: {window}");
    }
    println!("{} {branch} ({cleaned})", Color::Green.paint("Pruned:"));
    true
}
