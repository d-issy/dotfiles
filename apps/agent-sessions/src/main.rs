mod claude;
mod codex;
mod files;
mod json;
mod render;
mod sessions;
mod text;
mod tui;
mod types;

use std::io::{self, IsTerminal, Write};

use render::project_name;
use sessions::{
    Discovery, filter_sessions, now_ms, session_row, session_rows, session_runtime, to_rows,
};
use text::{format_age, format_duration, one_line, parse_duration, slice_utf16};
use tui::Tui;

const USAGE: &str = "agent-session - watch Claude Code and Codex sessions live

Usage:
  agent-session [--window DURATION] [--show-idle] [--list]

Options:
  -w, --window DURATION  Include Codex sessions updated within DURATION
                         (e.g. 30m, 2h, 1d). Default: 2h.
  -l, --list             Print the session list once and exit.
  -i, --show-idle        Include idle sessions (hidden by default).
  -h, --help             Show this help.

The list refreshes every 2 seconds. Press i to toggle idle sessions;
running subagents and sessions waiting for input stay visible. Finished Claude
subagents stay for 10 minutes. Select a session and press enter to follow its
log in real time (updated every 300ms).";

fn fail(message: &str) -> ! {
    eprint!("agent-session: {message}\n{USAGE}\n");
    std::process::exit(2);
}

fn print_list(window_ms: f64, show_idle: bool) {
    let now = now_ms();
    let rows = to_rows(&filter_sessions(
        Discovery::new().discover(window_ms, now),
        show_idle,
    ));
    let mut out = io::stdout().lock();
    for index in session_rows(&rows) {
        let Some(row) = session_row(&rows[index]) else {
            continue;
        };
        let session = row.session;
        let columns = [
            session.agent.as_str().to_string(),
            session.status.as_str().to_string(),
            session.model.clone().unwrap_or_else(|| "-".into()),
            format_duration(session_runtime(session, now).unwrap_or(0.0)),
            format_age(now - session.updated_at),
            project_name(&session.cwd).to_string(),
            format!("{}{}", row.tree, session.title),
            slice_utf16(&one_line(session.last.as_deref().unwrap_or("")), 120),
        ];
        if writeln!(out, "{}", columns.join("\t")).is_err() {
            return;
        }
    }
}

fn main() {
    let argv: Vec<String> = std::env::args_os()
        .skip(1)
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect();
    let mut window_ms = 2.0 * 3_600_000.0;
    let mut list = false;
    let mut show_idle = false;
    let mut index = 0;
    while index < argv.len() {
        match argv[index].as_str() {
            "-h" | "--help" => {
                println!("{USAGE}");
                return;
            }
            "-l" | "--list" => list = true,
            "-i" | "--show-idle" => show_idle = true,
            "-w" | "--window" => {
                let value = argv.get(index + 1).map_or("", String::as_str);
                match parse_duration(value) {
                    Some(parsed) => window_ms = parsed,
                    None => fail(&format!("invalid duration: {value}")),
                }
                index += 1;
            }
            arg => fail(&format!("unknown argument: {arg}")),
        }
        index += 1;
    }
    if list || !io::stdout().is_terminal() || !io::stdin().is_terminal() {
        print_list(window_ms, show_idle);
        return;
    }
    Tui::new(window_ms, show_idle).start();
}
