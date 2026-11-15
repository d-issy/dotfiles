//! worktree - personal git worktree helper.

mod common;
mod config;
mod create;
mod delete;
mod help;
mod list;
mod naming;
mod prune;
#[cfg(test)]
mod regression_tests;
mod rename;
mod repo;
mod status;
mod switch;
mod tmux;

use std::path::PathBuf;
use std::process::ExitCode;

use common::{Ctx, Fail, Res, die, error_line};
use config::Config;

const VERSION: &str = "0.1.0";

fn main() -> ExitCode {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let mut cfg = Config::default();
    if args.first().map(String::as_str) == Some("--config") && args.len() >= 2 {
        match Config::load(&args[1]) {
            Ok(loaded) => cfg = loaded,
            Err(message) => {
                eprintln!("{}", error_line(&message));
                return ExitCode::FAILURE;
            }
        }
        args.drain(..2);
    }

    let cwd = match std::env::var("WORKTREE_CALLER_PWD") {
        Ok(caller) if !caller.is_empty() => {
            let path = PathBuf::from(&caller);
            if !path.is_dir() {
                eprintln!("worktree: cd: {caller}: No such file or directory");
                return ExitCode::FAILURE;
            }
            std::env::current_dir().map_or(path.clone(), |current| current.join(&path))
        }
        _ => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
    };
    let ctx = Ctx::new(cwd, cfg);

    match dispatch(&ctx, &args) {
        Ok(()) | Err(Fail::Exit(0)) => ExitCode::SUCCESS,
        Err(Fail::Die(message)) => {
            eprintln!("{}", error_line(&message));
            ExitCode::FAILURE
        }
        Err(Fail::Exit(code)) => ExitCode::from(u8::try_from(code & 0xff).unwrap_or(1)),
    }
}

fn dispatch(ctx: &Ctx, args: &[String]) -> Res<()> {
    let Some(command) = args.first() else {
        print!("{}", help::MAIN);
        return Ok(());
    };
    let rest = &args[1..];
    match command.as_str() {
        "-h" | "--help" => {
            print!("{}", help::MAIN);
            Ok(())
        }
        "-v" | "--version" => {
            println!("worktree {VERSION}");
            Ok(())
        }
        "create" => create::run_command(ctx, rest),
        "list" => list::run_command(ctx, rest),
        "status" => status::run_command(ctx, rest),
        "switch" => switch::run_command(ctx, rest),
        "rename" => rename::run_command(ctx, rest),
        "prune" => prune::run_command(ctx, rest),
        "delete" => delete::run_command(ctx, rest),
        other => die(format!("Unknown command: {other}")),
    }
}
