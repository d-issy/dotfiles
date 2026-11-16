use std::path::{Path, PathBuf};

use crate::context::{Context, inside_tmux};
use crate::error::{Error, Result};
use crate::help;
use crate::names::{Names, short_window_from_branch};
use crate::pi::Mode;
use crate::process::CommandExt;
use crate::tmux::write_cd_directive;
use crate::ui::{Color, warn};

pub fn run(ctx: &Context, args: &[String]) -> Result<()> {
    ctx.require_git_repo()?;
    if matches!(args.first().map(String::as_str), Some("-h" | "--help")) {
        print!("{}", help::RENAME);
        return Ok(());
    }
    if args.len() > 1 {
        return Err(Error::fatal("rename accepts at most one branch name"));
    }
    let requested = args.first().filter(|branch| !branch.is_empty());

    let root = ctx.repo_root();
    if ctx.is_main_checkout_path(&root) {
        return Err(Error::fatal(format!(
            "Refusing to rename the main checkout: {root}"
        )));
    }
    let old_branch = ctx.current_branch();
    if old_branch.is_empty() {
        return Err(Error::fatal("Cannot rename a detached HEAD worktree"));
    }

    let Names { branch, window } = if let Some(branch) = requested {
        Names {
            branch: branch.clone(),
            window: short_window_from_branch(branch),
        }
    } else {
        if !has_changes_to_name(ctx) {
            return Err(Error::fatal("No changes available for name generation"));
        }
        let names = ctx.generate_names(Mode::Current)?;
        ctx.confirm_names(Mode::Current, names)?
    };

    if ctx
        .git(["check-ref-format", "--branch", &branch])
        .run_without_stdout()
        != 0
    {
        return Err(Error::fatal(format!("Invalid branch name: {branch}")));
    }
    if ctx.branch_exists(&branch) {
        return Err(Error::fatal(format!("Branch already exists: {branch}")));
    }
    let new_path = ctx.sibling_path_for_branch(&branch);
    if ctx.exists(&new_path) {
        return Err(Error::fatal(format!("Path already exists: {new_path}")));
    }

    ctx.git(["worktree", "move", &root, &new_path]).checked()?;
    let ctx = &follow_move(ctx, &root, &new_path);
    if ctx
        .git(["-C", &new_path, "branch", "-m", &old_branch, &branch])
        .run()
        != 0
    {
        if ctx
            .git(["-C", &new_path, "worktree", "move", &new_path, &root])
            .run()
            != 0
        {
            warn(&format!("Could not move worktree back to: {root}"));
        }
        return Err(Error::fatal(format!(
            "Could not rename branch; worktree left at: {root}"
        )));
    }
    ctx.save_window(&branch, &window)?;
    move_pending_state(ctx, &root, &new_path, &branch, &window)?;

    if inside_tmux() {
        ctx.rename_current_window(&window, &new_path)?;
    }
    write_cd_directive(&new_path)?;
    println!("{}", Color::Green.paint("Renamed worktree."));
    println!("Branch: {branch}\nPath: {new_path}\nWindow: {window}");
    Ok(())
}

fn has_changes_to_name(ctx: &Context) -> bool {
    ctx.git(["diff", "--quiet", "--exit-code", "HEAD"]).run() != 0
        || ctx
            .git(["diff", "--cached", "--quiet", "--exit-code"])
            .run()
            != 0
}

/// The shell version's working directory moved along with the worktree, since
/// it held the directory open; follow the move the same way.
fn follow_move(ctx: &Context, old_root: &str, new_root: &str) -> Context {
    let old = std::fs::canonicalize(old_root).unwrap_or_else(|_| PathBuf::from(old_root));
    match ctx.cwd.strip_prefix(&old) {
        Ok(rest) => ctx.with_cwd(Path::new(new_root).join(rest)),
        Err(_) => ctx.clone(),
    }
}

fn move_pending_state(
    ctx: &Context,
    old_path: &str,
    new_path: &str,
    branch: &str,
    window: &str,
) -> Result<()> {
    let old_state = ctx.pending_state_for(old_path);
    if !old_state.targets(old_path) {
        return Ok(());
    }
    let new_state = ctx.pending_state_for(new_path);
    old_state.move_to(&new_state)?;
    new_state.write_field("target_path", new_path)?;
    new_state.write_field("branch", branch)?;
    new_state.write_field("window", window)
}
