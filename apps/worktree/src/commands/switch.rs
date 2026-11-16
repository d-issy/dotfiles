use crate::context::Context;
use crate::error::{Error, Result};
use crate::help;
use crate::process::CommandExt;
use crate::shell::{bash_split_first_tab, pipe_lines};
use crate::worktrees::{Worktree, branch_from_label};

use super::pr;

#[derive(Debug, Default, PartialEq, Eq)]
struct Args {
    query: String,
    /// `--pr` was given; the number is empty when it should be picked.
    pr: Option<String>,
}

impl Args {
    /// None when help was requested.
    fn parse(args: &[String]) -> Option<Self> {
        let mut parsed = Self::default();
        let mut args = args.iter().peekable();
        while let Some(arg) = args.next() {
            if arg == "--pr" {
                let number = args.next_if(|next| !next.starts_with('-'));
                parsed.pr = Some(number.cloned().unwrap_or_default());
            } else if let Some(number) = arg.strip_prefix("--pr=") {
                parsed.pr = Some(number.to_string());
            } else if arg == "-h" || arg == "--help" {
                return None;
            } else {
                parsed.query.clone_from(arg);
            }
        }
        Some(parsed)
    }
}

pub fn run(ctx: &Context, args: &[String]) -> Result<()> {
    ctx.require_git_repo()?;
    let Some(args) = Args::parse(args) else {
        print!("{}", help::SWITCH);
        return Ok(());
    };

    if let Some(mut number) = args.pr {
        if number.is_empty() {
            number = pr::select_number(ctx);
        }
        if number.is_empty() || !number.bytes().all(|b| b.is_ascii_digit()) {
            return Err(Error::fatal(format!("PR number must be numeric: {number}")));
        }
        return pr::open_worktree(ctx, &number);
    }

    let path = select_worktree(ctx, &args.query)?;
    let branch = ctx
        .git(["-C", &path, "branch", "--show-current"])
        .discard_stderr()
        .stdout_text();
    let window = ctx.desired_window(&path, branch_from_label(&branch).as_deref());
    ctx.open_path(&path, &window)
}

fn path_of_selection(selection: &str) -> String {
    if selection.is_empty() {
        String::new()
    } else {
        bash_split_first_tab(selection).1.to_string()
    }
}

/// The chosen worktree path; empty when the fuzzy finder was cancelled.
fn select_worktree(ctx: &Context, query: &str) -> Result<String> {
    let worktrees = ctx.worktrees();
    if query.is_empty() {
        let lines: Vec<String> = worktrees.iter().map(Worktree::tsv_line).collect();
        let selection = ctx.fuzzy_select(&pipe_lines(&lines), "Worktrees", "1,2");
        return Ok(path_of_selection(&selection));
    }

    let mut matches: Vec<&Worktree> = worktrees
        .iter()
        .filter(|worktree| worktree.branch_label() == query)
        .collect();
    if matches.is_empty() {
        matches = worktrees
            .iter()
            .filter(|worktree| {
                worktree.branch_label().contains(query) || worktree.path.contains(query)
            })
            .collect();
    }
    match matches.as_slice() {
        [] => Err(Error::fatal(format!("No worktree matches: {query}"))),
        [only] => Ok(only.path.clone()),
        _ => {
            let lines: Vec<String> = matches.iter().map(|worktree| worktree.tsv_line()).collect();
            let selection = ctx.fuzzy_select(
                &pipe_lines(&lines),
                &format!("Worktrees matching: {query}"),
                "1,2",
            );
            Ok(path_of_selection(&selection))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(list: &[&str]) -> Option<Args> {
        Args::parse(
            &list
                .iter()
                .map(|arg| (*arg).to_string())
                .collect::<Vec<_>>(),
        )
    }

    #[test]
    fn parses_pr_forms() {
        assert_eq!(parse(&["--pr", "12"]).and_then(|a| a.pr), Some("12".into()));
        assert_eq!(
            parse(&["--pr", "-x"]).and_then(|a| a.pr),
            Some(String::new())
        );
        assert_eq!(parse(&["--pr=7"]).and_then(|a| a.pr), Some("7".into()));
        let args = parse(&["a", "b"]).unwrap_or_default();
        assert_eq!((args.query.as_str(), args.pr), ("b", None));
        assert_eq!(parse(&["--help"]), None);
    }
}
