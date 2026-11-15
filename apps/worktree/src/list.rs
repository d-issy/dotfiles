//! `worktree list`: a table of worktrees and their tmux windows.

use crate::common::{Ctx, Fail, Res, die};
use crate::help;
use crate::repo::{
    Record, awk_fields, default_branch_name, format_table, list_worktree_records, require_git_repo,
};

pub fn run_command(ctx: &Ctx, args: &[String]) -> Res<()> {
    require_git_repo(ctx)?;
    if let Some(arg) = args.first() {
        return match arg.as_str() {
            "-h" | "--help" => {
                print!("{}", help::LIST);
                Err(Fail::Exit(0))
            }
            other => die(format!("Unknown list option: {other}")),
        };
    }
    let rows: Vec<Vec<String>> = sorted_records(ctx)
        .iter()
        .map(|record| awk_fields(&record.line()))
        .collect();
    print!(
        "{}",
        format_table(&["Branch", "Window", "Managed", "Path"], &rows)
    );
    Ok(())
}

/// The default branch first, then the rest by branch name (`sort -k1,1 -k2,2`).
fn sorted_records(ctx: &Ctx) -> Vec<Record> {
    let default_branch = default_branch_name(ctx);
    let mut keyed: Vec<(String, String, String, Record)> = list_worktree_records(ctx)
        .into_iter()
        .map(|record| {
            let (rank, key) = if record.branch == default_branch {
                ("0", String::new())
            } else {
                ("1", record.branch.clone())
            };
            let line = format!("{rank}\t{key}\t{}", record.line());
            (rank.to_string(), key, line, record)
        })
        .collect();
    keyed.sort_by(|a, b| (&a.0, &a.1, &a.2).cmp(&(&b.0, &b.1, &b.2)));
    keyed.into_iter().map(|(_, _, _, record)| record).collect()
}
