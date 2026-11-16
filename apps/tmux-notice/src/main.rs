mod error;
mod notice;
mod status;
mod tmux;

use std::path::Path;
use std::process::ExitCode;

enum Program {
    Notice,
    PaneNotice,
    StatusSessions,
    StatusWindowNotices,
}

impl Program {
    fn from_argv0(argv0: &str) -> Self {
        match Path::new(argv0).file_name().and_then(|n| n.to_str()) {
            Some("tmux-pane-notice") => Self::PaneNotice,
            Some("tmux-status-sessions") => Self::StatusSessions,
            Some("tmux-status-window-notices") => Self::StatusWindowNotices,
            _ => Self::Notice,
        }
    }
}

fn main() -> ExitCode {
    let mut args = std::env::args();
    let program = Program::from_argv0(&args.next().unwrap_or_default());
    let args: Vec<String> = args.collect();

    let result = match program {
        Program::Notice => notice::run(&args),
        Program::PaneNotice => {
            status::pane_notice(&args);
            Ok(())
        }
        Program::StatusSessions => {
            status::sessions(&args);
            Ok(())
        }
        Program::StatusWindowNotices => {
            status::window_notices(&args);
            Ok(())
        }
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::from(e.exit_code())
        }
    }
}
