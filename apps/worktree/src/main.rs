mod cleanup;
mod commands;
mod config;
mod context;
mod error;
mod help;
mod merged;
mod names;
mod pi;
mod process;
#[cfg(test)]
mod regression_tests;
mod repo;
mod shell;
mod state;
mod table;
mod temp;
mod tmux;
mod tty;
mod ui;
mod windows;
mod worktrees;

use std::path::PathBuf;
use std::process::ExitCode;

use config::Config;
use context::Context;
use error::{Error, Result};

const VERSION: &str = "0.1.0";

fn main() -> ExitCode {
    match try_main() {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            err.report();
            ExitCode::from(err.exit_code())
        }
    }
}

fn try_main() -> Result<()> {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let mut config = Config::default();
    if let [flag, path, ..] = args.as_slice()
        && flag == "--config"
    {
        config = Config::load(path).map_err(Error::Fatal)?;
        args.drain(..2);
    }
    let ctx = Context::new(starting_directory()?, config);
    dispatch(&ctx, &args)
}

/// `WORKTREE_CALLER_PWD`, set by the shell wrapper, which runs the command
/// from a parent directory so the caller's directory can be removed.
fn starting_directory() -> Result<PathBuf> {
    match std::env::var("WORKTREE_CALLER_PWD") {
        Ok(caller) if !caller.is_empty() => {
            let path = PathBuf::from(&caller);
            if !path.is_dir() {
                return Err(Error::Message(format!(
                    "worktree: cd: {caller}: No such file or directory"
                )));
            }
            Ok(
                std::env::current_dir()
                    .map_or_else(|_| path.clone(), |current| current.join(&path)),
            )
        }
        _ => Ok(std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))),
    }
}

fn dispatch(ctx: &Context, args: &[String]) -> Result<()> {
    let Some((command, rest)) = args.split_first() else {
        print!("{}", help::MAIN);
        return Ok(());
    };
    match command.as_str() {
        "-h" | "--help" => {
            print!("{}", help::MAIN);
            Ok(())
        }
        "-v" | "--version" => {
            println!("worktree {VERSION}");
            Ok(())
        }
        "create" => commands::create::run(ctx, rest),
        "list" => commands::list::run(ctx, rest),
        "status" => commands::status::run(ctx, rest),
        "switch" => commands::switch::run(ctx, rest),
        "rename" => commands::rename::run(ctx, rest),
        "prune" => commands::prune::run(ctx, rest),
        "delete" => commands::delete::run(ctx, rest),
        other => Err(Error::fatal(format!("Unknown command: {other}"))),
    }
}
