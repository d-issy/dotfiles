mod config;
mod list;

use crate::error::{Error, USAGE};
use crate::tmux::{self, Pane};
use config::Config;

#[derive(Default, Clone, Copy)]
enum ClearScope {
    Pane,
    #[default]
    Window,
    Session,
    All,
}

impl ClearScope {
    fn from_flag(flag: &str) -> Option<Self> {
        match flag {
            "--pane" => Some(Self::Pane),
            "--window" => Some(Self::Window),
            "--session" => Some(Self::Session),
            "--all" => Some(Self::All),
            _ => None,
        }
    }
}

#[derive(Default)]
struct Args {
    target: String,
    rest: Vec<String>,
}

enum Parsed {
    Args(Args),
    Help,
}

impl Args {
    fn parse(argv: &[String]) -> Result<Parsed, Error> {
        let mut args = Self::default();
        let mut it = argv.iter();
        while let Some(arg) = it.next() {
            match arg.as_str() {
                "-t" | "--target" => {
                    args.target = it
                        .next()
                        .ok_or_else(|| Error::MissingTarget(arg.clone()))?
                        .clone();
                }
                "-h" | "--help" => return Ok(Parsed::Help),
                "--" => {
                    args.rest.extend(it.cloned());
                    break;
                }
                _ => args.rest.push(arg.clone()),
            }
        }
        Ok(Parsed::Args(args))
    }

    /// The explicit target, else `$TMUX_PANE`.
    fn pane(&self) -> Option<String> {
        if !self.target.is_empty() {
            return Some(self.target.clone());
        }
        std::env::var("TMUX_PANE").ok().filter(|p| !p.is_empty())
    }

    fn display(&self, format: &str) -> String {
        match self.pane() {
            Some(pane) => Pane(&pane).display(format),
            None => tmux::capture(&["display-message", "-p", format]),
        }
    }
}

/// `pane_active:window_active:session_attached` of a pane the user is looking at.
fn is_visible_active(state: &str) -> bool {
    match state.split(':').collect::<Vec<_>>().as_slice() {
        ["1", "1", attached] => {
            let mut chars = attached.chars();
            matches!(chars.next(), Some('1'..='9')) && chars.all(|c| c.is_ascii_digit())
        }
        _ => false,
    }
}

const CLEARED_OPTIONS: [&str; 12] = [
    "@tmux_notice_name",
    "@tmux_notice_icons",
    "@tmux_notice_session_notification_indicator_color",
    "@tmux_notice_session_indicator_color",
    "@tmux_notice_color",
    "@tmux_notice_original_title",
    "@tmux_notice_has_original_title",
    "@tmux_notice_restore_title",
    "@status_notice_icon",
    "@pane_notice_icon",
    "@pane_notice_title",
    "@pi_waiting",
];

fn clear_pane(pane: &Pane) {
    let has_original = pane.option("@tmux_notice_has_original_title");
    let original_title = pane.option("@tmux_notice_original_title");
    let restore_title = pane.option("@tmux_notice_restore_title");

    if has_original == "1" && restore_title == "1" {
        pane.set_title(&original_title);
    }
    for option in CLEARED_OPTIONS {
        pane.set_option(option, "");
    }
}

fn clear_panes(panes: &[String]) {
    for pane in panes.iter().filter(|p| !p.is_empty()) {
        clear_pane(&Pane(pane));
    }
    tmux::refresh_status();
}

fn clear(args: &Args) -> Result<(), Error> {
    let mut scope = ClearScope::default();
    for flag in &args.rest {
        scope =
            ClearScope::from_flag(flag).ok_or_else(|| Error::UnknownClearOption(flag.clone()))?;
    }

    match scope {
        ClearScope::Pane => {
            if let Some(pane) = args.pane() {
                clear_panes(&[pane]);
            }
        }
        ClearScope::Window => {
            let window = args.display("#{window_id}");
            if !window.is_empty() {
                clear_panes(&tmux::list_panes(&["-t", &window]));
            }
        }
        ClearScope::Session => {
            let session = args.display("#{session_id}");
            if !session.is_empty() {
                clear_panes(&tmux::list_panes(&["-s", "-t", &session]));
            }
        }
        ClearScope::All => clear_panes(&tmux::list_panes(&["-a"])),
    }
    Ok(())
}

fn on(args: &Args) -> Result<(), Error> {
    let name = args.rest.first().ok_or(Error::MissingNoticeName)?;
    let Some(pane_id) = args.pane() else {
        return Ok(());
    };
    let pane = Pane(&pane_id);

    let state = pane.display("#{pane_active}:#{window_active}:#{session_attached}");
    if is_visible_active(&state) {
        return Ok(());
    }

    let config = Config::load()?;
    let notice = config.notice(name);
    let current_title = pane.title();
    let title = notice.derive_title(&current_title, name)?;
    let icon = notice.first_icon();

    if pane.option("@tmux_notice_has_original_title") != "1" {
        pane.set_option("@tmux_notice_original_title", &current_title);
        pane.set_option("@tmux_notice_has_original_title", "1");
    }

    pane.set_option("@tmux_notice_name", name);
    pane.set_option("@tmux_notice_icons", &notice.joined_icons());
    pane.set_option(
        "@tmux_notice_session_notification_indicator_color",
        notice
            .session_notification_indicator_color
            .as_deref()
            .unwrap_or(""),
    );
    pane.set_option("@tmux_notice_session_indicator_color", "");
    pane.set_option("@tmux_notice_color", "");
    pane.set_option("@status_notice_icon", icon);
    pane.set_option("@pane_notice_icon", icon);
    pane.set_option("@pane_notice_title", &title);

    if notice.pane_title.enable {
        pane.set_title(&notice.pane_title.render(icon, &title, name));
        // The shell version derived this from jq's `.restoreOnClear // true`,
        // which is true even for `false`; restoreOnClear therefore never
        // disabled restoring, and that is preserved.
        pane.set_option("@tmux_notice_restore_title", "1");
    }

    tmux::refresh_status();
    Ok(())
}

fn off(args: &Args) {
    let expected = args.rest.first().map_or("", String::as_str);
    let Some(pane_id) = args.pane() else {
        return;
    };
    let pane = Pane(&pane_id);
    if !expected.is_empty() && pane.option("@tmux_notice_name") != expected {
        return;
    }
    clear_pane(&pane);
    tmux::refresh_status();
}

pub fn run(argv: &[String]) -> Result<(), Error> {
    let (command, rest) = argv.split_first().ok_or(Error::NoCommand)?;
    let args = match Args::parse(rest)? {
        Parsed::Args(args) => args,
        Parsed::Help => {
            print!("{USAGE}");
            return Ok(());
        }
    };

    match command.as_str() {
        "on" => on(&args),
        "off" => {
            off(&args);
            Ok(())
        }
        "clear" => clear(&args),
        "list" => {
            print!("{}", list::format(&Config::load()?));
            Ok(())
        }
        "-h" | "--help" | "help" => {
            print!("{USAGE}");
            Ok(())
        }
        other => Err(Error::UnknownCommand(other.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn visible_active_matches_regex() {
        assert!(is_visible_active("1:1:1"));
        assert!(is_visible_active("1:1:12"));
        assert!(!is_visible_active("1:1:0"));
        assert!(!is_visible_active("1:1:01"));
        assert!(!is_visible_active("0:1:1"));
        assert!(!is_visible_active("1:0:1"));
        assert!(!is_visible_active("1:1:"));
        assert!(!is_visible_active("1:1:1:1"));
        assert!(!is_visible_active(""));
    }

    #[test]
    fn target_parsing() {
        let argv: Vec<String> = ["done", "-t", "%3", "--", "-t", "x"]
            .iter()
            .map(ToString::to_string)
            .collect();
        let Ok(Parsed::Args(p)) = Args::parse(&argv) else {
            panic!()
        };
        assert_eq!(p.target, "%3");
        assert_eq!(p.rest, ["done", "-t", "x"]);
        assert!(matches!(
            Args::parse(&["-t".to_string()]),
            Err(Error::MissingTarget(flag)) if flag == "-t"
        ));
        assert!(matches!(Args::parse(&["-h".to_string()]), Ok(Parsed::Help)));
    }
}
