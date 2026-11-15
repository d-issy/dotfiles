//! `worktree switch`: jump to a worktree, or open a GitHub PR worktree.

use crate::common::{
    Ctx, Fail, Res, capture, capture_quiet, checked, checked_capture, die, fuzzy_select,
    lines_text, run, starts_with_yes, succeeds, tty_print, tty_read_checked, warn,
};
use crate::help;
use crate::repo::{
    branch_checked_out_path, branch_exists, desired_window_for_worktree, has_local_changes,
    list_worktrees, repo_sibling_path_for_pr, require_git_repo, set_saved_window_for_branch,
    worktree_tsv,
};
use crate::tmux::open_path;

pub fn run_command(ctx: &Ctx, args: &[String]) -> Res<()> {
    require_git_repo(ctx)?;
    let mut query = String::new();
    let mut pr: Option<String> = None;
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if arg == "--pr" {
            match args.get(index + 1) {
                Some(next) if !next.starts_with('-') => {
                    pr = Some(next.clone());
                    index += 2;
                }
                _ => {
                    pr = Some(String::new());
                    index += 1;
                }
            }
        } else if let Some(value) = arg.strip_prefix("--pr=") {
            pr = Some(value.to_string());
            index += 1;
        } else if arg == "-h" || arg == "--help" {
            print!("{}", help::SWITCH);
            return Err(Fail::Exit(0));
        } else {
            query.clone_from(arg);
            index += 1;
        }
    }

    if let Some(mut number) = pr {
        if number.is_empty() {
            number = select_pr_number(ctx);
        }
        if number.is_empty() || !number.bytes().all(|b| b.is_ascii_digit()) {
            return die(format!("PR number must be numeric: {number}"));
        }
        return open_pr_worktree(ctx, &number);
    }

    let path = select_worktree(ctx, &query)?;
    let branch = capture_quiet(&mut ctx.git(["-C", &path, "branch", "--show-current"])).1;
    let branch = if branch.is_empty() {
        "detached".to_string()
    } else {
        branch
    };
    let window = desired_window_for_worktree(ctx, &path, &branch);
    open_path(ctx, &path, &window)
}

fn finder_args(header: &str, with_nth: &str) -> Vec<String> {
    vec![
        format!("--header={header}"),
        format!("--with-nth={with_nth}"),
    ]
}

/// The path of the chosen worktree; empty when the finder was cancelled.
fn select_worktree(ctx: &Ctx, query: &str) -> Res<String> {
    let rows = worktree_tsv(&list_worktrees(ctx));
    let path_of = |line: &str| crate::common::split_first_tab(line).1;
    if query.is_empty() {
        let selected = fuzzy_select(ctx, &lines_text(&rows), &finder_args("Worktrees", "1,2"));
        return Ok(if selected.is_empty() {
            selected
        } else {
            path_of(&selected)
        });
    }

    let field = |line: &str, index: usize| line.split('\t').nth(index).unwrap_or("").to_string();
    let mut matches: Vec<&String> = rows.iter().filter(|line| field(line, 0) == query).collect();
    if matches.is_empty() {
        let slash_query = format!("/{query}");
        matches = rows
            .iter()
            .filter(|line| {
                let (branch, path) = (field(line, 0), field(line, 1));
                branch.contains(query) || path.contains(query) || path.contains(&slash_query)
            })
            .collect();
    }
    let matches: Vec<&String> = matches
        .into_iter()
        .filter(|line| !line.is_empty())
        .collect();
    match matches.len() {
        0 => die(format!("No worktree matches: {query}")),
        1 => Ok(path_of(matches[0])),
        _ => {
            let selected = fuzzy_select(
                ctx,
                &lines_text(&matches),
                &finder_args(&format!("Worktrees matching: {query}"), "1,2"),
            );
            Ok(if selected.is_empty() {
                selected
            } else {
                path_of(&selected)
            })
        }
    }
}

/// The PR number picked in the fuzzy finder; empty when cancelled.
fn select_pr_number(ctx: &Ctx) -> String {
    let list = capture(&mut ctx.gh([
        "pr",
        "list",
        "--limit",
        "100",
        "--json",
        "number,title,headRefName",
        "--jq",
        r##".[] | "#\(.number)\t\(.title)\t\(.headRefName)""##,
    ]))
    .1;
    let list = if list.is_empty() {
        list
    } else {
        format!("{list}\n")
    };
    let selected = fuzzy_select(ctx, &list, &finder_args("Pull requests", "1,2,3"));
    if selected.is_empty() {
        return selected;
    }
    let first = crate::common::split_first_tab(&selected).0;
    first.strip_prefix('#').unwrap_or(&first).to_string()
}

fn fetch_pr_ref(ctx: &Ctx, number: &str, temp_ref: &str) -> bool {
    run(&mut ctx.git([
        "fetch",
        "--no-prune",
        "origin",
        &format!("+refs/pull/{number}/head:{temp_ref}"),
    ])) == 0
        && succeeds(&mut ctx.git(["show-ref", "--verify", "--quiet", temp_ref]))
}

fn delete_ref(ctx: &Ctx, temp_ref: &str) -> Res<()> {
    checked(&mut ctx.git(["update-ref", "-d", temp_ref]))
}

/// Open or refresh the worktree for a GitHub PR, preserving local work.
pub fn open_pr_worktree(ctx: &Ctx, number: &str) -> Res<()> {
    require_git_repo(ctx)?;
    let window = format!("pr-{number}");
    let target = repo_sibling_path_for_pr(ctx, number);
    let temp_ref = format!("refs/worktree-pr/{number}");

    let mut branch = checked_capture(&mut ctx.gh([
        "pr",
        "view",
        number,
        "--json",
        "headRefName",
        "--jq",
        ".headRefName",
    ]))?;
    if branch.is_empty() || branch == "null" {
        return die(format!("Could not resolve PR branch for #{number}"));
    }

    let git_marker = ctx.resolve(&format!("{target}/.git"));
    if git_marker.is_dir() || git_marker.is_file() {
        return refresh_pr_worktree(ctx, number, &target, &temp_ref, &window);
    }

    if ctx.exists(&target) {
        return die(format!("Path already exists: {target}"));
    }
    if !fetch_pr_ref(ctx, number, &temp_ref) {
        return die(format!("Could not fetch PR #{number}"));
    }
    if branch_exists(ctx, &branch) {
        branch = format!("worktree/pr-{number}");
    }
    if branch_exists(ctx, &branch) {
        let existing = branch_checked_out_path(ctx, &branch);
        if !existing.is_empty() {
            warn(&format!("PR branch is already checked out at: {existing}"));
            delete_ref(ctx, &temp_ref)?;
            set_saved_window_for_branch(ctx, &branch, &window)?;
            return open_path(ctx, &existing, &window);
        }
        if run(&mut ctx.git(["merge-base", "--is-ancestor", &branch, &temp_ref])) != 0 {
            return die(format!(
                "Local branch {branch} has commits outside the fetched PR head; preserving it. Rename it before retrying."
            ));
        }
        checked(&mut ctx.git(["branch", "-f", &branch, &temp_ref]))?;
    } else {
        checked(&mut ctx.git(["branch", &branch, &temp_ref]))?;
    }
    delete_ref(ctx, &temp_ref)?;
    checked(&mut ctx.git(["worktree", "add", &target, &branch]))?;
    set_saved_window_for_branch(ctx, &branch, &window)?;
    open_path(ctx, &target, &window)
}

fn refresh_pr_worktree(
    ctx: &Ctx,
    number: &str,
    target: &str,
    temp_ref: &str,
    window: &str,
) -> Res<()> {
    if !fetch_pr_ref(ctx, number, temp_ref) {
        warn(&format!("Could not update PR #{number}; switching only."));
        return open_path(ctx, target, window);
    }
    if run(&mut ctx.git([
        "-C",
        target,
        "merge-base",
        "--is-ancestor",
        "HEAD",
        temp_ref,
    ])) != 0
    {
        warn(
            "PR worktree has commits outside the fetched PR head; preserving them and switching only.",
        );
        delete_ref(ctx, temp_ref)?;
        return open_path(ctx, target, window);
    }
    let mut dirty = false;
    if has_local_changes(ctx, target) {
        dirty = true;
        tty_print("PR worktree has local changes.\n")?;
        let response = tty_read_checked("Force update and discard local changes? [y/N] ")?;
        if starts_with_yes(&response) {
            checked(&mut ctx.git(["-C", target, "reset", "--hard"]))?;
            checked(&mut ctx.git(["-C", target, "clean", "-fd"]))?;
            dirty = false;
        } else {
            warn("Skipping update; switching only.");
        }
    }
    if !dirty {
        checked(&mut ctx.git(["-C", target, "reset", "--hard", temp_ref]))?;
    }
    delete_ref(ctx, temp_ref)?;
    let branch = checked_capture(&mut ctx.git(["-C", target, "branch", "--show-current"]))?;
    set_saved_window_for_branch(ctx, &branch, window)?;
    open_path(ctx, target, window)
}
