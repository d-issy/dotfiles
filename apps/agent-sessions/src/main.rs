mod claude;
mod cli;
mod codex;
mod error;
mod files;
mod format;
mod js;
mod json;
mod model;
mod pi;
mod render;
mod sessions;
#[cfg(test)]
mod test_support;
mod text;
mod tui;

use std::io::{self, IsTerminal, Write};
use std::process::ExitCode;

use cli::{Command, Options, USAGE};
use error::Error;
use format::{format_age, format_turn_time};
use render::project_name;
use sessions::{Discovery, Row, filter_sessions, now_ms, to_rows};
use text::one_line;

fn print_list(options: &Options) {
    let now = now_ms();
    let sessions = Discovery::from_env().discover(options.window_ms, now);
    let rows = to_rows(&filter_sessions(sessions, options.show_idle));
    let mut out = io::stdout().lock();
    for row in rows.iter().filter_map(Row::as_session) {
        let session = &row.session;
        let columns = [
            session.agent.as_str(),
            session.status.as_str(),
            session.model.as_deref().unwrap_or("-"),
            &format_turn_time(session.turn_elapsed(now)),
            &format_age(now - session.updated_at),
            project_name(&session.cwd),
            &format!("{}{}", row.tree, session.title),
            &js::slice_utf16(&one_line(session.last.as_deref().unwrap_or("")), 120),
        ];
        if writeln!(out, "{}", columns.join("\t")).is_err() {
            return;
        }
    }
}

fn run() -> Result<(), Error> {
    let args = std::env::args_os()
        .skip(1)
        .map(|arg| arg.to_string_lossy().into_owned());
    match Command::parse(args)? {
        Command::Help => println!("{USAGE}"),
        Command::Run(options)
            if options.list || !io::stdout().is_terminal() || !io::stdin().is_terminal() =>
        {
            print_list(&options);
        }
        Command::Run(options) => tui::run(options.window_ms, options.show_idle)?,
    }
    Ok(())
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(Error::Usage(message)) => {
            eprint!("agent-session: {message}\n{USAGE}\n");
            ExitCode::from(2)
        }
        Err(error) => {
            eprintln!("agent-session: {error}");
            ExitCode::FAILURE
        }
    }
}
