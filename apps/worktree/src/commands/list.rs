use crate::context::Context;
use crate::error::{Error, Result};
use crate::help;
use crate::table::{self, awk_tab_columns};
use crate::worktrees::Record;

pub fn run(ctx: &Context, args: &[String]) -> Result<()> {
    ctx.require_git_repo()?;
    if let Some(arg) = args.first() {
        return match arg.as_str() {
            "-h" | "--help" => {
                print!("{}", help::LIST);
                Ok(())
            }
            other => Err(Error::fatal(format!("Unknown list option: {other}"))),
        };
    }
    let rows: Vec<[String; 4]> = sorted_records(ctx)
        .iter()
        .map(|record| awk_tab_columns(&record.tsv_line()))
        .collect();
    print!(
        "{}",
        table::render(["Branch", "Window", "Managed", "Path"], &rows)
    );
    Ok(())
}

/// The default branch first, then the rest by branch name, then by the whole
/// keyed line, as `sort -t $'\t' -k1,1 -k2,2` ordered the shell version's output.
fn sorted_records(ctx: &Context) -> Vec<Record> {
    let default_branch = ctx.default_branch_name();
    let mut records = ctx.records();
    records.sort_by_cached_key(|record| {
        let branch = record.worktree.branch_label();
        let (rank, key) = if branch == default_branch {
            ("0", "")
        } else {
            ("1", branch)
        };
        let line = format!("{rank}\t{key}\t{}", record.tsv_line());
        (rank, key.to_string(), line)
    });
    records
}
