mod app;
mod bash;
mod cli;
mod color;
mod config;
mod editor;
mod error;
mod git;
mod pi;
mod prompt;
mod staged;
mod tty;

use app::App;
use cli::{Command, HELP, VERSION};
use color::Color;
use error::Result;
use std::io::Write;

fn execute() -> Result<()> {
    let (config, args) = config::Config::from_args(std::env::args().skip(1))?;
    match Command::parse(&args) {
        Command::Help => print!("{HELP}"),
        Command::Version => println!("git-auto-commit {VERSION}"),
        Command::Unknown(arg) => {
            bash::say(&Color::Red.paint(format!("Unknown option: {arg}")));
            print!("{HELP}");
            return Err(error::Error::Exit(1));
        }
        Command::Run { direct } => App::new(config, direct).run()?,
    }
    Ok(())
}

fn main() {
    let code = match execute() {
        Ok(()) => 0,
        Err(e) => {
            e.report();
            e.exit_code()
        }
    };
    let _ = std::io::stdout().flush();
    std::process::exit(code);
}
