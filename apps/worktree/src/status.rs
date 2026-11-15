//! `worktree status`: pending create state and PR worktree details.

use std::path::Path;

use crate::common::{BLUE, Ctx, Fail, RESET, Res, basename, die, read_file, run};
use crate::help;
use crate::repo::{
    find_state_for_current_target, has_local_changes, pr_number_suffix, repo_root, require_git_repo,
};

pub fn run_command(ctx: &Ctx, args: &[String]) -> Res<()> {
    require_git_repo(ctx)?;
    if let Some(arg) = args.first() {
        return match arg.as_str() {
            "-h" | "--help" => {
                print!("{}", help::STATUS);
                Err(Fail::Exit(0))
            }
            _ => die("status does not accept arguments"),
        };
    }

    let root = repo_root(ctx);
    let mut printed = false;
    if let Some(state) = find_state_for_current_target(ctx) {
        printed = true;
        let field = |name: &str| read_file(&Path::new(&state).join(name)).unwrap_or_default();
        println!("{BLUE}Create pending{RESET}\n");
        println!("Source: {}", field("source_path"));
        println!("Target: {}", field("target_path"));
        println!("Branch: {}", field("branch"));
        println!("\nFinish after verifying copied changes:\n  worktree create --finish");
    }

    let base = basename(&root);
    if let Some(number) = pr_number_suffix(&base) {
        if printed {
            println!();
        }
        printed = true;
        println!("{BLUE}PR worktree{RESET}\n");
        println!("PR: #{number}");
        run(ctx
            .gh([
                "pr",
                "view",
                number,
                "--json",
                "number,title,state,headRefName,updatedAt",
                "--jq",
                r#""Title: \(.title)\nState: \(.state)\nBranch: \(.headRefName)\nUpdated: \(.updatedAt)""#,
            ])
            .stderr(std::process::Stdio::null()));
        if has_local_changes(ctx, ".") {
            println!("Local changes: yes");
        } else {
            println!("Local changes: no");
        }
    }

    if !printed {
        println!("No pending worktree operation.");
    }
    Ok(())
}
