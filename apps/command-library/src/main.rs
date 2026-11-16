mod candidates;
mod cli;
mod config;
mod display;
mod environment;
mod error;
mod fzf;
mod library;
mod resolve;
mod select;
#[cfg(test)]
mod testing;

use cli::{Invocation, USAGE, parse_args};
use config::load_config;
use environment::SystemEnvironment;
use error::{Error, Result};
use fzf::{EXIT_CANCELLED, Fzf, FzfPrompter};
use library::items;
use resolve::resolve_command;
use select::select_item;
use std::process::ExitCode;

fn run() -> Result<ExitCode> {
    let args = match parse_args(
        std::env::args_os()
            .skip(1)
            .map(|arg| arg.to_string_lossy().into_owned()),
    )? {
        Invocation::Help => {
            println!("{USAGE}");
            return Ok(ExitCode::SUCCESS);
        }
        Invocation::Run(args) => args,
    };
    let config = load_config(&args.config)?;
    let list = items(&config, Some(&SystemEnvironment::new()));
    let Some(item) = select_item(&config, &list, &args, &mut Fzf { config: &config })? else {
        return Ok(ExitCode::from(EXIT_CANCELLED));
    };
    let mut prompter = FzfPrompter {
        config: &config,
        picker: Fzf { config: &config },
    };
    let Some(command) = resolve_command(&item, &mut prompter)? else {
        return Ok(ExitCode::from(EXIT_CANCELLED));
    };
    println!("{command}");
    Ok(ExitCode::SUCCESS)
}

fn main() -> ExitCode {
    run().unwrap_or_else(|error| {
        match &error {
            Error::Usage(message) => eprintln!("command-library: {message}\n{USAGE}"),
            Error::Failure(message) => eprintln!("command-library: {message}"),
        }
        ExitCode::from(match error {
            Error::Usage(_) => 2,
            Error::Failure(_) => 1,
        })
    })
}
