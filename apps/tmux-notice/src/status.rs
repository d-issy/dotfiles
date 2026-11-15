//! `tmux-pane-notice`, `tmux-status-sessions`, `tmux-status-window-notices`.
//!
//! tmux runs these on every status refresh. Styling values come from the
//! environment set by the Nix wrapper.

use crate::tmux;
use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};

const FS: char = '\u{1f}';

fn env(name: &str) -> String {
    std::env::var(name).unwrap_or_default()
}

fn frame() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn print_no_newline(s: &str) {
    use std::io::Write;
    let mut out = std::io::stdout().lock();
    let _ = out.write_all(s.as_bytes());
    let _ = out.flush();
}

fn blink_icon(frame: u64) -> &'static str {
    if frame.is_multiple_of(2) { "•" } else { " " }
}

/// Splits like bash `IFS='|' read -a`: a single trailing delimiter does not
/// create an extra empty field.
fn split_icons(raw: &str) -> Vec<&str> {
    if raw.is_empty() {
        return Vec::new();
    }
    let mut parts: Vec<&str> = raw.split('|').collect();
    if raw.ends_with('|') {
        parts.pop();
    }
    parts
}

fn notice_icon_at(raw: &str, frame: u64) -> String {
    let parts = split_icons(raw);
    if parts.is_empty() {
        return String::new();
    }
    let n = parts.len() as u64;
    let local = frame % (n + 1);
    if local >= n {
        parts[0].to_string()
    } else {
        parts[local as usize].to_string()
    }
}

struct PaneNoticeStyle<'a> {
    inactive_style: &'a str,
    bright: &'a str,
}

fn render_pane_notice(
    fields: [&str; 4],
    scope: &str,
    label: &str,
    frame: u64,
    style: &PaneNoticeStyle,
) -> String {
    let [mut raw_icons, fallback_icon, mut notice_title, pane_title] = fields;
    if raw_icons.is_empty() {
        raw_icons = fallback_icon;
    }
    if notice_title.is_empty() {
        notice_title = pane_title;
    }

    if raw_icons.is_empty() {
        return if scope == "inactive" && !label.is_empty() {
            format!("#[{}]{} {}", style.inactive_style, label, pane_title)
        } else {
            pane_title.to_string()
        };
    }

    let icon = notice_icon_at(raw_icons, frame);
    if scope == "inactive" {
        let mut out = format!("#[{}]{} ", style.inactive_style, label);
        if icon.chars().any(|c| !c.is_whitespace()) {
            out.push_str(&format!("#[fg={}]{}", style.bright, icon));
        } else {
            out.push_str(&icon);
        }
        out.push_str(&format!("#[{}] {}", style.inactive_style, notice_title));
        out
    } else {
        format!("{icon} {notice_title}")
    }
}

pub fn pane_notice(args: &[String]) -> u8 {
    let target = args.first().map(String::as_str).unwrap_or("");
    let scope = args.get(1).map(String::as_str).unwrap_or("");
    let label = args.get(2).map(String::as_str).unwrap_or("");
    if target.is_empty() {
        return 0;
    }

    let frame = frame();
    let line = tmux::capture(&[
        "display-message",
        "-p",
        "-t",
        target,
        "#{@tmux_notice_icons}\u{1f}#{@pane_notice_icon}\u{1f}#{@pane_notice_title}\u{1f}#{pane_title}",
    ]);
    let mut it = line.splitn(4, FS);
    let fields = [
        it.next().unwrap_or(""),
        it.next().unwrap_or(""),
        it.next().unwrap_or(""),
        it.next().unwrap_or(""),
    ];

    let inactive_style = env("TMUX_STATUS_PANE_INACTIVE_STYLE");
    let bright = env("TMUX_STATUS_NOTICE_BRIGHT");
    let style = PaneNoticeStyle {
        inactive_style: &inactive_style,
        bright: &bright,
    };
    print_no_newline(&render_pane_notice(fields, scope, label, frame, &style));
    0
}

/// Session id -> notice color, and set of windows containing a notice.
struct NoticeLookup {
    session_color: HashMap<String, String>,
    windows: HashSet<String>,
}

fn parse_notice_panes(output: &str, default_color: &str) -> NoticeLookup {
    let mut lookup = NoticeLookup {
        session_color: HashMap::new(),
        windows: HashSet::new(),
    };
    for line in output.lines() {
        let mut it = line.splitn(4, FS);
        let session = it.next().unwrap_or("");
        let window = it.next().unwrap_or("");
        let name = it.next().unwrap_or("");
        let color = it.next().unwrap_or("");
        if name.is_empty() {
            continue;
        }
        lookup.windows.insert(window.to_string());
        lookup
            .session_color
            .entry(session.to_string())
            .or_insert_with(|| {
                if color.is_empty() {
                    default_color
                } else {
                    color
                }
                .to_string()
            });
    }
    lookup
}

fn load_notice_panes(default_color: &str) -> NoticeLookup {
    parse_notice_panes(
        &tmux::output(&[
            "list-panes",
            "-a",
            "-F",
            "#{session_id}\u{1f}#{window_id}\u{1f}#{@tmux_notice_name}\u{1f}#{@tmux_notice_session_notification_indicator_color}",
        ]),
        default_color,
    )
}

struct SessionColors<'a> {
    active: &'a str,
    inactive: &'a str,
}

/// Returns the rendered session list and its display width.
fn render_sessions(
    list_output: &str,
    current: &str,
    lookup: &NoticeLookup,
    frame: u64,
    colors: &SessionColors,
) -> (String, usize) {
    let mut output = String::new();
    let mut width = 0;
    for line in list_output.lines() {
        let (id, name) = line.split_once(FS).unwrap_or((line, ""));
        if id.is_empty() {
            continue;
        }
        let name_color = if id == current {
            colors.active
        } else {
            colors.inactive
        };
        let icon = if lookup.session_color.contains_key(id) {
            blink_icon(frame)
        } else {
            ""
        };

        output.push_str(&format!("#[range=session|{id}]"));
        if let Some(color) = lookup.session_color.get(id).filter(|_| !icon.is_empty()) {
            output.push_str(&format!("#[fg={color}]{icon}"));
        }
        output.push_str(&format!("#[fg={name_color}]{name}  #[norange]"));
        width += icon.chars().count() + name.chars().count() + 2;
    }
    (output, width)
}

fn window_list_width(list_output: &str, lookup: &NoticeLookup, session_windows: i64) -> i64 {
    let mut total = 0i64;
    for line in list_output.lines() {
        let mut it = line.splitn(3, FS);
        let id = it.next().unwrap_or("");
        let index = it.next().unwrap_or("");
        let name = it.next().unwrap_or("");
        let mut w = index.chars().count() as i64 + 2;
        if name != "Window" {
            w += name.chars().count() as i64 + 1;
        }
        if lookup.windows.contains(id) {
            w += 1;
        }
        total += w;
    }
    if session_windows > 1 {
        total += session_windows - 1;
    }
    total
}

fn target_justify(client_width: i64, window_width: i64, session_width: i64) -> &'static str {
    // Prefer a true absolute centre; fall back to tmux's non-overlapping
    // centre layout when the session list would collide with it.
    let left_prefix_width = 6;
    let safe_left_limit = client_width / 2 - (window_width + 1) / 2 - 1;
    if left_prefix_width + session_width > safe_left_limit {
        "centre"
    } else {
        "absolute-centre"
    }
}

fn parse_uint(s: &str) -> Option<i64> {
    if !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()) {
        s.parse().ok()
    } else {
        None
    }
}

pub fn sessions(args: &[String]) -> u8 {
    let current = args.first().map(String::as_str).unwrap_or("");
    let client_width = args.get(1).map(String::as_str).filter(|s| !s.is_empty());
    let session_windows = args.get(2).map(String::as_str).unwrap_or("1");
    let frame = frame();

    let bright = env("TMUX_STATUS_NOTICE_BRIGHT");
    let active = env("TMUX_STATUS_SESSION_ACTIVE");
    let inactive = env("TMUX_STATUS_SESSION_INACTIVE");

    let lookup = load_notice_panes(&bright);
    let (output, session_width) = render_sessions(
        &tmux::output(&["list-sessions", "-F", "#{session_id}\u{1f}#{session_name}"]),
        current,
        &lookup,
        frame,
        &SessionColors {
            active: &active,
            inactive: &inactive,
        },
    );

    if let (Some(width), Some(windows)) = (
        parse_uint(client_width.unwrap_or("0")),
        parse_uint(session_windows),
    ) && windows > 1
    {
        let list = tmux::output(&[
            "list-windows",
            "-t",
            current,
            "-F",
            "#{window_id}\u{1f}#{window_index}\u{1f}#{window_name}",
        ]);
        let window_width = window_list_width(&list, &lookup, windows);
        let target = target_justify(width, window_width, session_width as i64);
        let current_justify =
            tmux::capture(&["show-options", "-qv", "-t", current, "status-justify"]);
        if current_justify != target {
            tmux::quiet(&["set-option", "-q", "-t", current, "status-justify", target]);
        }
    }

    print_no_newline(&output);
    0
}

pub fn window_notices(args: &[String]) -> u8 {
    let target = args.first().map(String::as_str).unwrap_or("");
    if target.is_empty() {
        return 0;
    }
    let frame = frame();
    let out = tmux::output(&["list-panes", "-t", target, "-F", "#{@tmux_notice_name}"]);
    if out.lines().any(|l| !l.is_empty()) {
        print_no_newline(blink_icon(frame));
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    const STYLE: PaneNoticeStyle = PaneNoticeStyle {
        inactive_style: "fg=grey",
        bright: "colour3",
    };

    #[test]
    fn icon_animation_cycles_with_extra_first_frame() {
        // n icons -> n+1 frames; the last frame repeats the first icon.
        assert_eq!(notice_icon_at("a|b", 0), "a");
        assert_eq!(notice_icon_at("a|b", 1), "b");
        assert_eq!(notice_icon_at("a|b", 2), "a");
        assert_eq!(notice_icon_at("a|b", 3), "a");
        assert_eq!(notice_icon_at("a|b", 4), "b");
        assert_eq!(notice_icon_at("x", 7), "x");
        assert_eq!(notice_icon_at("", 3), "");
    }

    #[test]
    fn icon_split_matches_bash_read() {
        assert_eq!(split_icons("a|b"), ["a", "b"]);
        assert_eq!(split_icons("a|"), ["a"]);
        assert_eq!(split_icons("a||b"), ["a", "", "b"]);
        assert_eq!(split_icons("|"), [""]);
        assert_eq!(split_icons("• | "), ["• ", " "]);
    }

    #[test]
    fn blink() {
        assert_eq!(blink_icon(10), "•");
        assert_eq!(blink_icon(11), " ");
    }

    #[test]
    fn pane_notice_without_notice() {
        let f = ["", "", "", "shell"];
        assert_eq!(render_pane_notice(f, "", "", 0, &STYLE), "shell");
        assert_eq!(render_pane_notice(f, "active", "2", 0, &STYLE), "shell");
        assert_eq!(
            render_pane_notice(f, "inactive", "2", 0, &STYLE),
            "#[fg=grey]2 shell"
        );
        assert_eq!(render_pane_notice(f, "inactive", "", 0, &STYLE), "shell");
    }

    #[test]
    fn pane_notice_with_notice() {
        let f = ["a|b", "a", "", "shell"];
        assert_eq!(render_pane_notice(f, "active", "", 1, &STYLE), "b shell");
        let f = ["a|b", "a", "Title", "shell"];
        assert_eq!(
            render_pane_notice(f, "inactive", "3", 1, &STYLE),
            "#[fg=grey]3 #[fg=colour3]b#[fg=grey] Title"
        );
        // Blank icon frames are printed without a colour.
        let f = ["•| ", "•", "T", "shell"];
        assert_eq!(
            render_pane_notice(f, "inactive", "3", 1, &STYLE),
            "#[fg=grey]3  #[fg=grey] T"
        );
        // Falls back to the single icon when the icon list is empty.
        let f = ["", "•", "T", "shell"];
        assert_eq!(render_pane_notice(f, "", "", 5, &STYLE), "• T");
    }

    #[test]
    fn notice_pane_lookup() {
        let out = "$1\u{1f}@1\u{1f}\u{1f}\n$1\u{1f}@2\u{1f}done\u{1f}colour9\n$1\u{1f}@3\u{1f}x\u{1f}\n$2\u{1f}@4\u{1f}y\u{1f}\n";
        let l = parse_notice_panes(out, "bright");
        assert_eq!(l.session_color["$1"], "colour9");
        assert_eq!(l.session_color["$2"], "bright");
        assert!(l.windows.contains("@2") && l.windows.contains("@3") && l.windows.contains("@4"));
        assert!(!l.windows.contains("@1"));
    }

    #[test]
    fn sessions_render() {
        let lookup = parse_notice_panes("$2\u{1f}@4\u{1f}y\u{1f}\n", "bright");
        let colors = SessionColors {
            active: "white",
            inactive: "grey",
        };
        let list = "$1\u{1f}main\n$2\u{1f}work\n";
        let (out, width) = render_sessions(list, "$1", &lookup, 2, &colors);
        assert_eq!(
            out,
            "#[range=session|$1]#[fg=white]main  #[norange]#[range=session|$2]#[fg=bright]•#[fg=grey]work  #[norange]"
        );
        assert_eq!(width, 6 + 1 + 4 + 2);
        let (out, _) = render_sessions(list, "$1", &lookup, 3, &colors);
        assert!(out.contains("#[fg=bright] #[fg=grey]work"));
    }

    #[test]
    fn window_widths_and_justify() {
        let lookup = parse_notice_panes("$1\u{1f}@2\u{1f}y\u{1f}\n", "b");
        let list = "@1\u{1f}1\u{1f}Window\n@2\u{1f}10\u{1f}vim\n";
        // "1" -> 3; "10"+"vim" -> 4+4=8, +1 notice = 9; plus (2-1) separators.
        assert_eq!(window_list_width(list, &lookup, 2), 3 + 9 + 1);
        // limit = 100/2 - (13+1)/2 - 1 = 42
        assert_eq!(target_justify(100, 13, 36), "absolute-centre");
        assert_eq!(target_justify(100, 13, 37), "centre");
        assert_eq!(target_justify(0, 13, 0), "centre");
    }

    #[test]
    fn uint_parsing() {
        assert_eq!(parse_uint("120"), Some(120));
        assert_eq!(parse_uint(""), None);
        assert_eq!(parse_uint("-1"), None);
        assert_eq!(parse_uint("1x"), None);
    }
}
