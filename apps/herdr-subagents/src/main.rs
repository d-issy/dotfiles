mod cleanup;
mod error;
mod fsutil;
mod herdr;
mod interrupt;
mod json;
mod manifest;
mod preset;
mod session;
mod start;
mod status;
mod version;

use error::{Result, die};
use session::Session;
use std::process;

const USAGE: &str = "Usage:
  herdr-subagents start NAME=PRESET [NAME=PRESET ...]
  herdr-subagents status
  herdr-subagents cleanup [--force]

Presets:
  pi  astra  sol  luna  opus  fable  grok  composer

Split the current Pi pane in half and manage equally sized Herdr subagent panes.
";

enum Command<'a> {
    Start(&'a [String]),
    Status,
    Cleanup { force: bool },
    Help,
    Missing,
    Unknown,
}

impl<'a> Command<'a> {
    fn parse(args: &'a [String]) -> Result<Self> {
        let Some(command) = args.first().filter(|command| !command.is_empty()) else {
            return Ok(Self::Missing);
        };
        let rest = &args[1..];
        Ok(match command.as_str() {
            "start" => Self::Start(rest),
            "status" if rest.is_empty() => Self::Status,
            "status" => return die("status does not accept arguments"),
            "cleanup" => match rest {
                [] => Self::Cleanup { force: false },
                [flag] if flag == "--force" => Self::Cleanup { force: true },
                _ => return die("cleanup accepts only --force"),
            },
            "-h" | "--help" | "help" => Self::Help,
            _ => Self::Unknown,
        })
    }
}

fn run(args: &[String]) -> Result<i32> {
    let session = Session::from_env()?;
    match Command::parse(args)? {
        Command::Start(specs) => start::run(&session, specs).map(|()| 0),
        Command::Status => status::show(&session).map(|()| 0),
        Command::Cleanup { force } => cleanup::run(&session, force),
        Command::Help => {
            print!("{USAGE}");
            Ok(0)
        }
        Command::Missing => {
            print!("{USAGE}");
            Ok(2)
        }
        Command::Unknown => {
            eprint!("{USAGE}");
            Ok(2)
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = run(&args).unwrap_or_else(|error| {
        if !error.is_silent() {
            eprintln!("herdr-subagents: {error}");
        }
        error.exit_code()
    });
    process::exit(code);
}
