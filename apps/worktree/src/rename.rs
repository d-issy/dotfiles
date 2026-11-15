//! `worktree rename`: rename the branch, directory, and tmux window together.

use std::path::{Path, PathBuf};

use crate::common::{
    Ctx, Fail, GREEN, RESET, Res, checked, die, is_inside_tmux, run, run_no_stdout,
    split_first_tab, warn, write_line,
};
use crate::help;
use crate::naming::{Mode, confirm_names, generate_names};
use crate::repo::{
    branch_exists, current_branch, repo_root, repo_sibling_path_for_branch, require_git_repo,
    set_saved_window_for_branch, short_window_from_branch, state_dir_for_target, state_targets,
};
use crate::tmux::{is_main_checkout_path, rename_current_window, write_cd_directive};

pub fn run_command(ctx: &Ctx, args: &[String]) -> Res<()> {
    require_git_repo(ctx)?;
    if matches!(args.first().map(String::as_str), Some("-h" | "--help")) {
        print!("{}", help::RENAME);
        return Err(Fail::Exit(0));
    }
    if args.len() > 1 {
        return die("rename accepts at most one branch name");
    }
    let mut new_branch = args.first().cloned().unwrap_or_default();

    let root = repo_root(ctx);
    if is_main_checkout_path(ctx, &root) {
        return die(format!("Refusing to rename the main checkout: {root}"));
    }
    let old_branch = current_branch(ctx);
    if old_branch.is_empty() {
        return die("Cannot rename a detached HEAD worktree");
    }

    let new_window;
    if new_branch.is_empty() {
        if !has_any_diff_for_names(ctx) {
            return die("No changes available for name generation");
        }
        let (branch, window) = split_first_tab(&generate_names(ctx, Mode::Current)?);
        (new_branch, new_window) = confirm_names(ctx, Mode::Current, "Rename", branch, window)?;
    } else {
        new_window = short_window_from_branch(&new_branch);
    }

    if run_no_stdout(&mut ctx.git(["check-ref-format", "--branch", &new_branch])) != 0 {
        return die(format!("Invalid branch name: {new_branch}"));
    }
    if branch_exists(ctx, &new_branch) {
        return die(format!("Branch already exists: {new_branch}"));
    }
    let new_path = repo_sibling_path_for_branch(ctx, &new_branch);
    if ctx.exists(&new_path) {
        return die(format!("Path already exists: {new_path}"));
    }

    checked(&mut ctx.git(["worktree", "move", &root, &new_path]))?;
    // The original shell kept its directory handle across the move; follow it.
    let ctx = &follow_move(ctx, &root, &new_path);
    if run(&mut ctx.git(["-C", &new_path, "branch", "-m", &old_branch, &new_branch])) != 0 {
        if run(&mut ctx.git(["-C", &new_path, "worktree", "move", &new_path, &root])) != 0 {
            warn(&format!("Could not move worktree back to: {root}"));
        }
        return die(format!("Could not rename branch; worktree left at: {root}"));
    }
    set_saved_window_for_branch(ctx, &new_branch, &new_window)?;
    update_pending_state_after_rename(ctx, &root, &new_path, &new_branch, &new_window)?;

    if is_inside_tmux() {
        rename_current_window(ctx, &new_window, &new_path)?;
    }
    write_cd_directive(&new_path)?;
    println!("{GREEN}Renamed worktree.{RESET}");
    println!("Branch: {new_branch}\nPath: {new_path}\nWindow: {new_window}");
    Ok(())
}

fn has_any_diff_for_names(ctx: &Ctx) -> bool {
    run(&mut ctx.git(["diff", "--quiet", "--exit-code", "HEAD"])) != 0
        || run(&mut ctx.git(["diff", "--cached", "--quiet", "--exit-code"])) != 0
}

/// The working directory after `old_root` moved to `new_root`.
fn follow_move(ctx: &Ctx, old_root: &str, new_root: &str) -> Ctx {
    let old = std::fs::canonicalize(old_root).unwrap_or_else(|_| PathBuf::from(old_root));
    match ctx.cwd.strip_prefix(&old) {
        Ok(rest) => ctx.with_cwd(Path::new(new_root).join(rest)),
        Err(_) => ctx.clone(),
    }
}

fn update_pending_state_after_rename(
    ctx: &Ctx,
    old_path: &str,
    new_path: &str,
    new_branch: &str,
    new_window: &str,
) -> Res<()> {
    let old_state = state_dir_for_target(ctx, old_path);
    if !state_targets(&old_state, old_path) {
        return Ok(());
    }
    let new_state = PathBuf::from(state_dir_for_target(ctx, new_path));
    if let Some(parent) = new_state.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::rename(&old_state, &new_state).map_err(|err| {
        eprintln!(
            "mv: cannot move '{old_state}' to '{}': {}",
            new_state.display(),
            crate::common::io_message(&err)
        );
        Fail::Exit(1)
    })?;
    write_line(&new_state.join("target_path"), new_path)?;
    write_line(&new_state.join("branch"), new_branch)?;
    write_line(&new_state.join("window"), new_window)
}
