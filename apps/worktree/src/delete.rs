//! `worktree delete`: remove a worktree and, by default, its local branch.

use crate::common::{
    BLUE, Ctx, Fail, GREEN, RESET, Res, YELLOW, basename, checked, checked_capture, confirm_yes,
    die, fuzzy_select, is_inside_tmux, lines_text, tty_print,
};
use crate::help;
use crate::repo::{
    Record, has_local_changes, list_worktree_records, managed_repo_root, managed_worktree_records,
    remove_pending_state_for_path, repo_root, require_git_repo, unset_saved_window_for_branch,
};
use crate::tmux::{close_window_for_deleted_path, write_cd_directive};

pub fn run_command(ctx: &Ctx, args: &[String]) -> Res<()> {
    require_git_repo(ctx)?;
    let mut target = String::new();
    let mut keep_branch = false;
    for arg in args {
        match arg.as_str() {
            "-h" | "--help" => {
                print!("{}", help::DELETE);
                return Err(Fail::Exit(0));
            }
            "--keep-branch" => keep_branch = true,
            _ => {
                if !target.is_empty() {
                    return die("delete accepts only one target");
                }
                target.clone_from(arg);
            }
        }
    }

    let record = resolve_delete_record(ctx, &target)?;
    ensure_deletable_record(ctx, record.as_ref())?;
    match record {
        Some(record) => delete_record(ctx, &record, keep_branch),
        None => die("No worktree selected"),
    }
}

fn finder_args(header: &str) -> Vec<String> {
    vec![format!("--header={header}"), "--with-nth=1,2,4".into()]
}

/// A selection from the finder; None when cancelled.
fn pick(ctx: &Ctx, records: &[Record], header: &str) -> Option<Record> {
    let lines: Vec<String> = records.iter().map(Record::line).collect();
    let selected = fuzzy_select(ctx, &lines_text(&lines), &finder_args(header));
    (!selected.is_empty()).then(|| Record::parse(&selected))
}

fn resolve_delete_record(ctx: &Ctx, target: &str) -> Res<Option<Record>> {
    if target.is_empty() {
        let records = managed_worktree_records(ctx);
        if records.is_empty() {
            return die("No managed worktrees to delete");
        }
        return Ok(pick(ctx, &records, "Delete worktree"));
    }
    if target == "--current" || target == "." {
        return current_delete_record(ctx).map(Some);
    }
    let matches: Vec<Record> = managed_worktree_records(ctx)
        .into_iter()
        .filter(|record| {
            record.branch == target || basename(&record.path) == target || record.window == target
        })
        .collect();
    match matches.len() {
        0 => die(format!("No managed worktree exactly matches: {target}")),
        1 => Ok(matches.into_iter().next()),
        _ => Ok(pick(
            ctx,
            &matches,
            &format!("Delete worktree matching: {target}"),
        )),
    }
}

fn current_delete_record(ctx: &Ctx) -> Res<Record> {
    let root = repo_root(ctx);
    let key = ctx.canonical(&root);
    let Some(record) = list_worktree_records(ctx)
        .into_iter()
        .find(|record| ctx.canonical(&record.path) == key)
    else {
        return die("Current worktree is not listed by git worktree");
    };
    ensure_deletable_record(ctx, Some(&record))?;
    Ok(record)
}

fn ensure_deletable_record(ctx: &Ctx, record: Option<&Record>) -> Res<()> {
    let main_root = ctx.canonical(&managed_repo_root(ctx));
    let Some(record) = record else {
        return die("No worktree selected");
    };
    if ctx.canonical(&record.path) == main_root {
        return die(format!(
            "Refusing to delete the main checkout: {}",
            record.path
        ));
    }
    if record.branch == "detached" {
        return die(format!(
            "Refusing to delete detached worktree: {}",
            record.path
        ));
    }
    if record.managed != "yes" {
        return die(format!(
            "Refusing to delete unmanaged worktree: {}",
            record.path
        ));
    }
    Ok(())
}

/// Commits on the branch that no other branch or remote-tracking ref reaches.
pub fn branch_unique_commits(ctx: &Ctx, branch: &str) -> Res<String> {
    checked_capture(&mut ctx.git([
        "log",
        "--oneline",
        &format!("refs/heads/{branch}"),
        "--not",
        &format!("--exclude={branch}"),
        "--branches",
        "--remotes",
    ]))
}

fn confirm_delete_record(ctx: &Ctx, record: &Record, keep_branch: bool) -> Res<()> {
    if keep_branch {
        tty_print("\nDelete worktree and keep local branch?\n\n")?;
    } else {
        tty_print("\nDelete worktree and local branch?\n\n")?;
    }
    if has_local_changes(ctx, &record.path) {
        tty_print(&format!(
            "{YELLOW}Worktree has local changes. They will be discarded.{RESET}\n\n"
        ))?;
    }
    if !keep_branch {
        let unique = branch_unique_commits(ctx, &record.branch)?;
        if !unique.is_empty() {
            tty_print(&format!(
                "{YELLOW}Branch has commits not reachable from any other branch or remote. They will be lost:{RESET}\n{unique}\n\n"
            ))?;
        }
    }
    tty_print(&format!("{BLUE}Branch:{RESET} {}\n", record.branch))?;
    tty_print(&format!("{BLUE}Path:{RESET} {}\n", record.path))?;
    tty_print(&format!("{BLUE}Window:{RESET} {}\n\n", record.window))?;
    if keep_branch {
        tty_print("Local branch will be kept.\n")?;
    }
    tty_print("Remote branches and GitHub PRs will not be changed.\n\n")?;
    confirm_yes("Delete? [y/N] ", "/dev/tty")
}

fn delete_record(ctx: &Ctx, record: &Record, keep_branch: bool) -> Res<()> {
    let current_key = ctx.canonical(&repo_root(ctx));
    let path_key = ctx.canonical(&record.path);
    let mut destination = managed_repo_root(ctx);
    if !ctx.is_dir(&destination) {
        destination = std::env::var("HOME").unwrap_or_default();
    }

    confirm_delete_record(ctx, record, keep_branch)?;

    let dirty = has_local_changes(ctx, &record.path);
    let deleting_current = current_key == path_key;
    let moved;
    let ctx = if deleting_current {
        let path = ctx.resolve(&destination);
        if !path.is_dir() {
            eprintln!("worktree: cd: {destination}: No such file or directory");
            return Err(Fail::Exit(1));
        }
        moved = ctx.with_cwd(path);
        &moved
    } else {
        ctx
    };

    let mut remove = ctx.git(["worktree", "remove"]);
    if dirty {
        remove.arg("--force");
    }
    checked(remove.arg(&record.path))?;
    if !keep_branch {
        checked(&mut ctx.git(["branch", "-D", &record.branch]))?;
        unset_saved_window_for_branch(ctx, &record.branch);
    }
    remove_pending_state_for_path(ctx, &record.path);

    if deleting_current && !is_inside_tmux() {
        write_cd_directive(&destination)?;
    }
    close_window_for_deleted_path(ctx, &record.path, &destination);

    println!("{GREEN}Deleted worktree.{RESET}");
    println!(
        "Branch: {}\nPath: {}\nWindow: {}",
        record.branch, record.path, record.window
    );
    if keep_branch {
        println!("Kept local branch.");
    }
    if dirty {
        println!("Discarded local changes.");
    }
    Ok(())
}
