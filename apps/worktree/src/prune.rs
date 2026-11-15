//! `worktree prune`: delete merged local branches and their worktrees.

use std::sync::mpsc;

use crate::common::{
    Ctx, Fail, GREEN, RESET, Res, capture, capture_quiet, confirm_yes, die, run_no_stdout,
    succeeds, warn, warn_line,
};
use crate::help;
use crate::repo::{
    branch_checked_out_path, cleanup_stale_saved_windows, default_base_ref, default_branch_name,
    format_table, has_local_changes, managed_repo_root, remove_pending_state_for_path, repo_root,
    require_git_repo, unset_saved_window_for_branch, worktree_locked,
};
use crate::tmux::{close_window_for_deleted_path, window_name_for_path};

const PARALLELISM: usize = 4;

pub fn run_command(ctx: &Ctx, args: &[String]) -> Res<()> {
    require_git_repo(ctx)?;
    let mut force = false;
    let mut yes = false;
    for arg in args {
        match arg.as_str() {
            "-h" | "--help" => {
                print!("{}", help::PRUNE);
                return Err(Fail::Exit(0));
            }
            "-f" | "--force" => force = true,
            "-y" | "--yes" => yes = true,
            other => return die(format!("Unknown prune option: {other}")),
        }
    }

    let base = default_base_ref(ctx);
    if !succeeds(&mut ctx.git([
        "rev-parse",
        "--verify",
        "--quiet",
        &format!("{base}^{{commit}}"),
    ])) {
        return die(format!("Could not resolve prune base: {base}"));
    }
    let (targets, skipped) = collect_prune_records(ctx, &base, force);

    println!("Base: {base}");
    if !targets.is_empty() {
        println!("\nPrune targets:");
        let rows: Vec<Vec<String>> = targets.iter().map(Target::row).collect();
        print!(
            "{}",
            format_table(&["Branch", "Worktree", "Dirty", "Window"], &rows)
        );
    }
    if !skipped.is_empty() {
        println!("\nSkipped:");
        print!(
            "{}",
            format_table(&["Branch", "Reason", "Worktree"], &skipped)
        );
    }
    cleanup_stale_saved_windows(ctx);
    if targets.is_empty() {
        println!("\nNothing to prune.");
        return Ok(());
    }
    if !yes {
        println!();
        let source = std::env::var("WORKTREE_TTY")
            .ok()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "/dev/tty".into());
        confirm_yes(
            &format!("Prune {} branch(es)? [y/N] ", targets.len()),
            &source,
        )?;
    }
    if prune_records(ctx, &targets, force) {
        Ok(())
    } else {
        Err(Fail::Exit(1))
    }
}

/// A branch to prune, with its worktree path (`-` when none) and window.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    pub branch: String,
    pub path: String,
    pub dirty: bool,
    pub window: String,
}

impl Target {
    fn row(&self) -> Vec<String> {
        let dirty = if self.dirty { "yes" } else { "no" };
        vec![
            self.branch.clone(),
            self.path.clone(),
            dirty.into(),
            self.window.clone(),
        ]
    }
}

fn branch_upstream_gone(ctx: &Ctx, branch: &str) -> bool {
    capture_quiet(&mut ctx.git([
        "for-each-ref",
        "--format=%(upstream:track)",
        &format!("refs/heads/{branch}"),
    ]))
    .1 == "[gone]"
}

/// Every patch of the branch is already in `base` (`git cherry` shows no `+`).
fn branch_patch_merged(ctx: &Ctx, base: &str, branch: &str) -> bool {
    let cherry = capture_quiet(&mut ctx.git(["cherry", base, branch])).1;
    !cherry.is_empty()
        && !cherry
            .lines()
            .any(|line| line.split_whitespace().next() == Some("+"))
}

fn rev_parse_commit(ctx: &Ctx, rev: &str) -> String {
    capture_quiet(&mut ctx.git(["rev-parse", "--verify", &format!("{rev}^{{commit}}")])).1
}

/// GitHub reports the branch's PR merged at the branch's current tip.
fn branch_github_pr_merged(ctx: &Ctx, branch: &str) -> bool {
    let info = capture_quiet(&mut ctx.gh([
        "pr",
        "view",
        branch,
        "--json",
        "state,headRefOid",
        "--jq",
        "[.state, .headRefOid] | @tsv",
    ]))
    .1;
    if info.is_empty() {
        return false;
    }
    let first_line = info.lines().next().unwrap_or("");
    let fields = crate::common::read_tab_fields(first_line, 2);
    let (state, head_oid) = (&fields[0], &fields[1]);
    if state != "MERGED" || head_oid.is_empty() {
        return false;
    }
    rev_parse_commit(ctx, branch) == *head_oid
}

/// A branch created by `create` with no commits of its own is not merged;
/// its creation commit lives in config so this survives reflog expiry.
fn branch_never_moved(ctx: &Ctx, branch: &str) -> bool {
    let base =
        capture_quiet(&mut ctx.git(["config", "--get", &format!("branch.{branch}.worktreeBase")]))
            .1;
    !base.is_empty() && rev_parse_commit(ctx, &format!("refs/heads/{branch}")) == base
}

fn is_prunable(ctx: &Ctx, base: &str, branch: &str) -> bool {
    if succeeds(&mut ctx.git(["merge-base", "--is-ancestor", branch, base])) {
        !branch_never_moved(ctx, branch)
    } else if branch_upstream_gone(ctx, branch) {
        branch_patch_merged(ctx, base, branch) || branch_github_pr_merged(ctx, branch)
    } else {
        false
    }
}

/// Local branches merged into `base`, checked four at a time, in ref order.
pub fn list_prune_branches(ctx: &Ctx, base: &str) -> Vec<String> {
    let branches: Vec<String> =
        capture(&mut ctx.git(["for-each-ref", "--format=%(refname:short)", "refs/heads"]))
            .1
            .lines()
            .filter(|line| !line.is_empty())
            .map(str::to_string)
            .collect();
    let mut prunable = Vec::new();
    for batch in branches.chunks(PARALLELISM) {
        let results: Vec<bool> = std::thread::scope(|scope| {
            let handles: Vec<_> = batch
                .iter()
                .map(|branch| scope.spawn(move || is_prunable(ctx, base, branch)))
                .collect();
            handles
                .into_iter()
                .map(|handle| handle.join().unwrap_or(false))
                .collect()
        });
        prunable.extend(
            batch
                .iter()
                .zip(results)
                .filter(|(_, keep)| *keep)
                .map(|(branch, _)| branch.clone()),
        );
    }
    prunable
}

/// Split merged branches into prune targets and skipped rows (branch, reason, path).
pub fn collect_prune_records(
    ctx: &Ctx,
    base: &str,
    force: bool,
) -> (Vec<Target>, Vec<Vec<String>>) {
    let default_branch = default_branch_name(ctx);
    let current_key = ctx.canonical(&repo_root(ctx));
    let main_key = ctx.canonical(&managed_repo_root(ctx));
    let mut targets = Vec::new();
    let mut skipped = Vec::new();
    let mut skip = |branch: &str, reason: &str, path: &str| {
        skipped.push(vec![
            branch.to_string(),
            reason.to_string(),
            path.to_string(),
        ]);
    };

    for branch in list_prune_branches(ctx, base) {
        if branch == default_branch {
            continue;
        }
        let path = branch_checked_out_path(ctx, &branch);
        if path.is_empty() {
            targets.push(Target {
                branch,
                path: "-".into(),
                dirty: false,
                window: "-".into(),
            });
            continue;
        }
        let path_key = ctx.canonical(&path);
        if path_key == current_key {
            skip(&branch, "current worktree", &path);
            continue;
        }
        if path_key == main_key {
            skip(&branch, "main checkout", &path);
            continue;
        }
        if worktree_locked(ctx, &path) {
            skip(&branch, "locked worktree", &path);
            continue;
        }
        let dirty = has_local_changes(ctx, &path);
        if dirty && !force {
            skip(&branch, "dirty worktree", &path);
            continue;
        }
        let window = window_name_for_path(ctx, &path)
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| "-".into());
        targets.push(Target {
            branch,
            path,
            dirty,
            window,
        });
    }
    (targets, skipped)
}

/// Remove one prune target's worktree, collecting git's output in `log`.
/// A single `--force` honours worktree locks; never escalate past Git's refusal.
pub fn remove_prune_worktree(ctx: &Ctx, path: &str, force: bool, log: &mut Vec<u8>) -> bool {
    let mut command = ctx.git(["worktree", "remove"]);
    if force {
        command.arg("--force");
    }
    command.arg(path);
    let ok = match command.output() {
        Ok(output) => {
            log.extend_from_slice(&output.stdout);
            log.extend_from_slice(&output.stderr);
            output.status.success()
        }
        Err(err) => {
            log.extend_from_slice(
                format!("worktree: git: {}\n", crate::common::io_message(&err)).as_bytes(),
            );
            false
        }
    };
    if !ok {
        return false;
    }
    if ctx.exists_or_link(path) {
        log.extend_from_slice(
            format!(
                "{}\n",
                warn_line(&format!(
                    "git worktree remove left the path behind; preserving it: {path}"
                ))
            )
            .as_bytes(),
        );
        return false;
    }
    true
}

/// Remove worktrees (up to four at once) and then, serially as each one
/// finishes, delete its branch and saved window. Returns false on any failure.
pub fn prune_records(ctx: &Ctx, targets: &[Target], force: bool) -> bool {
    let mut failed = false;
    let (sender, receiver) = mpsc::channel::<(usize, bool, Vec<u8>)>();
    std::thread::scope(|scope| {
        let mut next = 0;
        let mut active = 0;
        while next < targets.len() || active > 0 {
            while next < targets.len() && active < PARALLELISM {
                let index = next;
                let target = &targets[index];
                let sender = sender.clone();
                scope.spawn(move || {
                    let mut log = Vec::new();
                    let ok = target.path == "-"
                        || remove_prune_worktree(ctx, &target.path, force, &mut log);
                    let _ = sender.send((index, ok, log));
                });
                next += 1;
                active += 1;
            }
            let Ok((index, ok, log)) = receiver.recv() else {
                break;
            };
            active -= 1;
            eprint!("{}", String::from_utf8_lossy(&log));
            if !finish_target(ctx, &targets[index], ok) {
                failed = true;
            }
        }
    });
    !failed
}

fn finish_target(ctx: &Ctx, target: &Target, removed: bool) -> bool {
    if !removed {
        warn(&format!(
            "Could not remove worktree for {}: {}",
            target.branch, target.path
        ));
        return false;
    }
    let mut cleaned = String::from("branch");
    if target.path != "-" {
        remove_pending_state_for_path(ctx, &target.path);
        close_window_for_deleted_path(ctx, &target.path, &managed_repo_root(ctx));
        cleaned.push_str(&format!(", worktree: {}", target.path));
    }
    if run_no_stdout(&mut ctx.git(["branch", "-D", &target.branch])) != 0 {
        warn(&format!("Could not delete branch: {}", target.branch));
        return false;
    }
    unset_saved_window_for_branch(ctx, &target.branch);
    if target.window != "-" {
        cleaned.push_str(&format!(", window: {}", target.window));
    }
    println!("{GREEN}Pruned:{RESET} {} ({cleaned})", target.branch);
    true
}
