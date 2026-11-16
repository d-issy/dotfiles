use crate::error::Error;
use crate::format::parse_duration;

pub const USAGE: &str = "agent-session - watch Claude Code and Codex sessions live

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

#[derive(Debug, PartialEq)]
pub struct Options {
    pub window_ms: f64,
    pub list: bool,
    pub show_idle: bool,
}

impl Default for Options {
    fn default() -> Self {
        Self {
            window_ms: 2.0 * 3_600_000.0,
            list: false,
            show_idle: false,
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum Command {
    Help,
    Run(Options),
}

impl Command {
    pub fn parse(args: impl IntoIterator<Item = String>) -> Result<Self, Error> {
        let mut options = Options::default();
        let mut args = args.into_iter();
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "-h" | "--help" => return Ok(Self::Help),
                "-l" | "--list" => options.list = true,
                "-i" | "--show-idle" => options.show_idle = true,
                "-w" | "--window" => {
                    let value = args.next().unwrap_or_default();
                    options.window_ms = parse_duration(&value)
                        .ok_or_else(|| Error::Usage(format!("invalid duration: {value}")))?;
                }
                _ => return Err(Error::Usage(format!("unknown argument: {arg}"))),
            }
        }
        Ok(Self::Run(options))
    }
}
