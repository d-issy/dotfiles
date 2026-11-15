//! Multi-call binary: dispatches on the basename of argv[0].
//!
//! `tmux-notice`, `tmux-pane-notice`, `tmux-status-sessions` and
//! `tmux-status-window-notices` are wrapper executables created by Nix that
//! exec this binary with the matching argv[0].

mod notice;
mod status;
mod tmux;

use std::path::Path;
use std::process::ExitCode;

fn main() -> ExitCode {
    let mut args = std::env::args();
    let argv0 = args.next().unwrap_or_default();
    let rest: Vec<String> = args.collect();
    let name = Path::new(&argv0)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    let code = match name {
        "tmux-pane-notice" => status::pane_notice(&rest),
        "tmux-status-sessions" => status::sessions(&rest),
        "tmux-status-window-notices" => status::window_notices(&rest),
        _ => notice::run(&rest),
    };
    ExitCode::from(code)
}
