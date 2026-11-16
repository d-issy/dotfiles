mod pane;
mod sessions;

use crate::tmux;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

const FIELD_SEPARATOR: char = '\u{1f}';

fn env(name: &str) -> String {
    std::env::var(name).unwrap_or_default()
}

/// Animation frame: the current epoch second.
fn frame() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

fn blink_icon(frame: u64) -> &'static str {
    if frame.is_multiple_of(2) { "•" } else { " " }
}

fn write_stdout(s: &str) {
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(s.as_bytes());
    let _ = out.flush();
}

fn arg(args: &[String], index: usize) -> &str {
    args.get(index).map_or("", String::as_str)
}

pub fn pane_notice(args: &[String]) {
    let target = arg(args, 0);
    if target.is_empty() {
        return;
    }
    let style = pane::Style::from_env();
    let fields = pane::Fields::query(target);
    write_stdout(&pane::render(
        &fields,
        arg(args, 1),
        arg(args, 2),
        frame(),
        &style,
    ));
}

pub fn sessions(args: &[String]) {
    let layout_inputs = sessions::Inputs {
        current: arg(args, 0),
        client_width: arg(args, 1),
        session_windows: args.get(2).map_or("1", String::as_str),
    };
    write_stdout(&sessions::run(&layout_inputs, frame()));
}

pub fn window_notices(args: &[String]) {
    let target = arg(args, 0);
    if target.is_empty() {
        return;
    }
    let frame = frame();
    let out = tmux::output(&["list-panes", "-t", target, "-F", "#{@tmux_notice_name}"]);
    if out.lines().any(|l| !l.is_empty()) {
        write_stdout(blink_icon(frame));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blink() {
        assert_eq!(blink_icon(10), "•");
        assert_eq!(blink_icon(11), " ");
    }
}
