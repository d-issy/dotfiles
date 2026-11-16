use crate::context::Context;
use crate::error::{Error, Result};
use crate::help;
use crate::names::pr_number_suffix;
use crate::process::CommandExt;
use crate::shell::basename;
use crate::ui::Color;

pub fn run(ctx: &Context, args: &[String]) -> Result<()> {
    ctx.require_git_repo()?;
    if let Some(arg) = args.first() {
        return match arg.as_str() {
            "-h" | "--help" => {
                print!("{}", help::STATUS);
                Ok(())
            }
            _ => Err(Error::fatal("status does not accept arguments")),
        };
    }

    let root = ctx.repo_root();
    let mut printed = false;
    if let Some(state) = ctx.pending_state_for_current() {
        printed = true;
        let field = |name| state.field(name).unwrap_or_default();
        println!("{}\n", Color::Blue.paint("Create pending"));
        println!("Source: {}", field("source_path"));
        println!("Target: {}", field("target_path"));
        println!("Branch: {}", field("branch"));
        println!("\nFinish after verifying copied changes:\n  worktree create --finish");
    }

    if let Some(number) = pr_number_suffix(basename(&root)) {
        if printed {
            println!();
        }
        printed = true;
        print_pr_status(ctx, number);
    }

    if !printed {
        println!("No pending worktree operation.");
    }
    Ok(())
}

fn print_pr_status(ctx: &Context, number: &str) {
    println!("{}\n", Color::Blue.paint("PR worktree"));
    println!("PR: #{number}");
    ctx.gh([
        "pr",
        "view",
        number,
        "--json",
        "number,title,state,headRefName,updatedAt",
        "--jq",
        r#""Title: \(.title)\nState: \(.state)\nBranch: \(.headRefName)\nUpdated: \(.updatedAt)""#,
    ])
    .discard_stderr()
    .run();
    let changes = if ctx.has_local_changes(".") {
        "yes"
    } else {
        "no"
    };
    println!("Local changes: {changes}");
}
