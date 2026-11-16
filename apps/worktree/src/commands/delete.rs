use std::path::Path;

use crate::context::{Context, inside_tmux};
use crate::error::{Error, Result};
use crate::help;
use crate::process::CommandExt;
use crate::shell::{basename, pipe_lines};
use crate::tmux::write_cd_directive;
use crate::tty::{self, TTY};
use crate::ui::Color;
use crate::worktrees::Record;

#[derive(Debug, Default, PartialEq, Eq)]
struct Args {
    target: String,
    keep_branch: bool,
}

impl Args {
    /// None when help was requested.
    fn parse(args: &[String]) -> Result<Option<Self>> {
        let mut parsed = Self::default();
        for arg in args {
            match arg.as_str() {
                "-h" | "--help" => return Ok(None),
                "--keep-branch" => parsed.keep_branch = true,
                _ if !parsed.target.is_empty() => {
                    return Err(Error::fatal("delete accepts only one target"));
                }
                _ => parsed.target.clone_from(arg),
            }
        }
        Ok(Some(parsed))
    }
}

pub fn run(ctx: &Context, args: &[String]) -> Result<()> {
    ctx.require_git_repo()?;
    let Some(args) = Args::parse(args)? else {
        print!("{}", help::DELETE);
        return Ok(());
    };
    let record = resolve_record(ctx, &args.target)?;
    ensure_deletable(ctx, record.as_ref())?;
    match record {
        Some(record) => delete(ctx, &record, args.keep_branch),
        None => Err(Error::fatal("No worktree selected")),
    }
}

fn pick(ctx: &Context, records: &[Record], header: &str) -> Option<Record> {
    let lines: Vec<String> = records.iter().map(Record::tsv_line).collect();
    let selection = ctx.fuzzy_select(&pipe_lines(&lines), header, "1,2,4");
    (!selection.is_empty()).then(|| Record::from_tsv_line(&selection))
}

fn resolve_record(ctx: &Context, target: &str) -> Result<Option<Record>> {
    match target {
        "" => {
            let records = ctx.managed_records();
            if records.is_empty() {
                return Err(Error::fatal("No managed worktrees to delete"));
            }
            Ok(pick(ctx, &records, "Delete worktree"))
        }
        "--current" | "." => current_record(ctx).map(Some),
        name => {
            let matches: Vec<Record> = ctx
                .managed_records()
                .into_iter()
                .filter(|record| {
                    record.worktree.branch_label() == name
                        || basename(&record.worktree.path) == name
                        || record.window_label() == name
                })
                .collect();
            match matches.as_slice() {
                [] => Err(Error::fatal(format!(
                    "No managed worktree exactly matches: {name}"
                ))),
                [only] => Ok(Some(only.clone())),
                _ => Ok(pick(
                    ctx,
                    &matches,
                    &format!("Delete worktree matching: {name}"),
                )),
            }
        }
    }
}

fn current_record(ctx: &Context) -> Result<Record> {
    let key = ctx.realpath(&ctx.repo_root());
    let record = ctx
        .records()
        .into_iter()
        .find(|record| ctx.realpath(&record.worktree.path) == key)
        .ok_or_else(|| Error::fatal("Current worktree is not listed by git worktree"))?;
    ensure_deletable(ctx, Some(&record))?;
    Ok(record)
}

fn ensure_deletable(ctx: &Context, record: Option<&Record>) -> Result<()> {
    let main_root = ctx.realpath(&ctx.managed_repo_root());
    let record = record.ok_or_else(|| Error::fatal("No worktree selected"))?;
    let path = &record.worktree.path;
    if ctx.realpath(path) == main_root {
        return Err(Error::fatal(format!(
            "Refusing to delete the main checkout: {path}"
        )));
    }
    if record.worktree.branch.is_none() {
        return Err(Error::fatal(format!(
            "Refusing to delete detached worktree: {path}"
        )));
    }
    if !record.managed {
        return Err(Error::fatal(format!(
            "Refusing to delete unmanaged worktree: {path}"
        )));
    }
    Ok(())
}

impl Context {
    /// Commits on the branch that no other branch or remote-tracking ref reaches.
    pub fn branch_unique_commits(&self, branch: &str) -> Result<String> {
        self.git([
            "log",
            "--oneline",
            &format!("refs/heads/{branch}"),
            "--not",
            &format!("--exclude={branch}"),
            "--branches",
            "--remotes",
        ])
        .checked_stdout()
    }
}

fn confirm(ctx: &Context, record: &Record, branch: &str, keep_branch: bool) -> Result<()> {
    let path = &record.worktree.path;
    if keep_branch {
        tty::print("\nDelete worktree and keep local branch?\n\n")?;
    } else {
        tty::print("\nDelete worktree and local branch?\n\n")?;
    }
    if ctx.has_local_changes(path) {
        tty::print(&format!(
            "{}\n\n",
            Color::Yellow.paint("Worktree has local changes. They will be discarded.")
        ))?;
    }
    if !keep_branch {
        let unique = ctx.branch_unique_commits(branch)?;
        if !unique.is_empty() {
            tty::print(&format!(
                "{}\n{unique}\n\n",
                Color::Yellow.paint(
                    "Branch has commits not reachable from any other branch or remote. They will be lost:"
                )
            ))?;
        }
    }
    tty::print(&format!("{} {branch}\n", Color::Blue.paint("Branch:")))?;
    tty::print(&format!("{} {path}\n", Color::Blue.paint("Path:")))?;
    tty::print(&format!(
        "{} {}\n\n",
        Color::Blue.paint("Window:"),
        record.window_label()
    ))?;
    if keep_branch {
        tty::print("Local branch will be kept.\n")?;
    }
    tty::print("Remote branches and GitHub PRs will not be changed.\n\n")?;
    tty::confirm("Delete? [y/N] ", Path::new(TTY))
}

fn delete(ctx: &Context, record: &Record, keep_branch: bool) -> Result<()> {
    let branch = record.worktree.branch_label();
    let path = record.worktree.path.as_str();
    let deleting_current = ctx.realpath(&ctx.repo_root()) == ctx.realpath(path);
    let mut destination = ctx.managed_repo_root();
    if !ctx.is_dir(&destination) {
        destination = std::env::var("HOME").unwrap_or_default();
    }

    confirm(ctx, record, branch, keep_branch)?;

    let dirty = ctx.has_local_changes(path);
    let moved;
    let ctx = if deleting_current {
        let new_cwd = ctx.resolve(&destination);
        if !new_cwd.is_dir() {
            return Err(Error::Message(format!(
                "worktree: cd: {destination}: No such file or directory"
            )));
        }
        moved = ctx.with_cwd(new_cwd);
        &moved
    } else {
        ctx
    };

    let mut remove = ctx.git(["worktree", "remove"]);
    if dirty {
        remove.arg("--force");
    }
    remove.arg(path).checked()?;
    if !keep_branch {
        ctx.git(["branch", "-D", branch]).checked()?;
        ctx.forget_window(branch);
    }
    ctx.remove_pending_state_for(path);

    if deleting_current && !inside_tmux() {
        write_cd_directive(&destination)?;
    }
    ctx.close_window_for_deleted_path(path, &destination);

    println!("{}", Color::Green.paint("Deleted worktree."));
    println!(
        "Branch: {branch}\nPath: {path}\nWindow: {}",
        record.window_label()
    );
    if keep_branch {
        println!("Kept local branch.");
    }
    if dirty {
        println!("Discarded local changes.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_delete_args() {
        let args = |list: &[&str]| {
            list.iter()
                .map(|arg| (*arg).to_string())
                .collect::<Vec<_>>()
        };
        let parsed = Args::parse(&args(&["--keep-branch", "--current"]))
            .ok()
            .flatten();
        assert_eq!(
            parsed,
            Some(Args {
                target: "--current".into(),
                keep_branch: true
            })
        );
        assert!(Args::parse(&args(&["a", "b"])).is_err());
        assert_eq!(Args::parse(&args(&["--help"])).ok().flatten(), None);
    }
}
