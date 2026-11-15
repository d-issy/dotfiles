//! tmux windows and the cd directive used outside tmux.

use std::process::Stdio;

use crate::common::{
    Ctx, Res, capture_quiet, checked, checked_capture, is_inside_tmux, read_tab_fields, run,
    run_no_stdout, write_line,
};
use crate::repo::managed_repo_root;

/// `tmux list-windows -F <format> 2>/dev/null` read with `IFS=$'\t' read -r`.
fn list_windows(ctx: &Ctx, format: &str, fields: usize) -> Vec<Vec<String>> {
    if !is_inside_tmux() {
        return Vec::new();
    }
    let output = capture_quiet(&mut ctx.tmux(["list-windows", "-F", format])).1;
    output
        .lines()
        .map(|line| read_tab_fields(line, fields))
        .collect()
}

/// A window whose `@worktree_path` or pane path is `path`.
pub fn window_for_path(ctx: &Ctx, path: &str) -> Option<String> {
    list_windows(
        ctx,
        "#{window_id}\t#{@worktree_path}\t#{pane_current_path}",
        3,
    )
    .into_iter()
    .find(|row| row[1] == path || row[2] == path)
    .map(|row| row[0].clone())
}

/// A window whose `@worktree_path` is `path`.
pub fn window_for_option_path(ctx: &Ctx, path: &str) -> Option<String> {
    list_windows(ctx, "#{window_id}\t#{@worktree_path}", 2)
        .into_iter()
        .find(|row| row[1] == path)
        .map(|row| row[0].clone())
}

pub fn window_name_for_path(ctx: &Ctx, path: &str) -> Option<String> {
    list_windows(ctx, "#{window_name}\t#{@worktree_path}", 2)
        .into_iter()
        .find(|row| row[1] == path)
        .map(|row| row[0].clone())
}

fn current_window_id(ctx: &Ctx) -> Option<String> {
    if !is_inside_tmux() {
        return None;
    }
    match capture_quiet(&mut ctx.tmux(["display-message", "-p", "#{window_id}"])) {
        (0, id) => Some(id),
        _ => None,
    }
}

/// Ask the shell wrapper to cd, or tell the user where to go.
pub fn write_cd_directive(path: &str) -> Res<()> {
    match std::env::var("WORKTREE_CD_FILE") {
        Ok(file) if !file.is_empty() => write_line(std::path::Path::new(&file), path),
        _ => {
            println!("Switch to: {path}");
            Ok(())
        }
    }
}

pub fn is_main_checkout_path(ctx: &Ctx, path: &str) -> bool {
    ctx.canonical(path) == ctx.canonical(&managed_repo_root(ctx))
}

/// Select or open a tmux window for `path`, or emit a cd directive outside tmux.
pub fn open_path(ctx: &Ctx, path: &str, window: &str) -> Res<()> {
    if !is_inside_tmux() {
        return write_cd_directive(path);
    }
    if is_main_checkout_path(ctx, path) {
        return match window_for_path(ctx, path) {
            Some(id) => checked(&mut ctx.tmux(["select-window", "-t", &id])),
            None => checked(ctx.tmux(["new-window", "-c", path]).stdout(Stdio::null())),
        };
    }
    let id = match window_for_path(ctx, path) {
        Some(id) => {
            checked(&mut ctx.tmux(["select-window", "-t", &id]))?;
            id
        }
        None => checked_capture(&mut ctx.tmux([
            "new-window",
            "-P",
            "-F",
            "#{window_id}",
            "-n",
            window,
            "-c",
            path,
        ]))?,
    };
    run_no_stdout(&mut ctx.tmux(["rename-window", "-t", &id, window]));
    for option in [
        ["automatic-rename", "off"],
        ["allow-rename", "off"],
        ["@worktree_path", path],
    ] {
        run_no_stdout(&mut ctx.tmux(["set-window-option", "-t", &id, option[0], option[1]]));
    }
    Ok(())
}

/// Close the tmux window of a deleted worktree, moving away first when it is current.
pub fn close_window_for_deleted_path(ctx: &Ctx, path: &str, destination: &str) {
    if !is_inside_tmux() {
        return;
    }
    let Some(id) = window_for_option_path(ctx, path).filter(|id| !id.is_empty()) else {
        return;
    };
    let current = current_window_id(ctx).unwrap_or_default();
    if id == current {
        match window_for_option_path(ctx, destination) {
            Some(destination_id) => {
                run(&mut ctx.tmux(["select-window", "-t", &destination_id]));
            }
            None => {
                run(ctx.tmux(["select-window", "-t", "!"]).stderr(Stdio::null()));
            }
        }
    }
    run(ctx.tmux(["kill-window", "-t", &id]).stderr(Stdio::null()));
}

/// The rename flow targets the current window without `-t`; the window name
/// change is fatal there while the options are best effort.
pub fn rename_current_window(ctx: &Ctx, window: &str, path: &str) -> Res<()> {
    checked(&mut ctx.tmux(["rename-window", window]))?;
    for option in [
        ["automatic-rename", "off"],
        ["allow-rename", "off"],
        ["@worktree_path", path],
    ] {
        run_no_stdout(&mut ctx.tmux(["set-window-option", option[0], option[1]]));
    }
    Ok(())
}
