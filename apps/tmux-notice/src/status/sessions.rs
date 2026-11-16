use super::{FIELD_SEPARATOR, blink_icon, env};
use crate::tmux;
use std::collections::{HashMap, HashSet};

pub struct Inputs<'a> {
    pub current: &'a str,
    pub client_width: &'a str,
    pub session_windows: &'a str,
}

struct NoticeLookup {
    session_color: HashMap<String, String>,
    windows: HashSet<String>,
}

impl NoticeLookup {
    fn query(default_color: &str) -> Self {
        Self::parse(
            &tmux::output(&[
                "list-panes",
                "-a",
                "-F",
                "#{session_id}\u{1f}#{window_id}\u{1f}#{@tmux_notice_name}\u{1f}#{@tmux_notice_session_notification_indicator_color}",
            ]),
            default_color,
        )
    }

    fn parse(output: &str, default_color: &str) -> Self {
        let mut lookup = Self {
            session_color: HashMap::new(),
            windows: HashSet::new(),
        };
        for line in output.lines() {
            let mut it = line.splitn(4, FIELD_SEPARATOR);
            let (session, window, name, color) = (
                it.next().unwrap_or(""),
                it.next().unwrap_or(""),
                it.next().unwrap_or(""),
                it.next().unwrap_or(""),
            );
            if name.is_empty() {
                continue;
            }
            lookup.windows.insert(window.to_string());
            let color = if color.is_empty() {
                default_color
            } else {
                color
            };
            lookup
                .session_color
                .entry(session.to_string())
                .or_insert_with(|| color.to_string());
        }
        lookup
    }
}

struct Colors {
    active: String,
    inactive: String,
}

struct SessionList {
    text: String,
    width: usize,
}

fn render_sessions(
    list_output: &str,
    current: &str,
    lookup: &NoticeLookup,
    frame: u64,
    colors: &Colors,
) -> SessionList {
    let mut list = SessionList {
        text: String::new(),
        width: 0,
    };
    for line in list_output.lines() {
        let (id, name) = line.split_once(FIELD_SEPARATOR).unwrap_or((line, ""));
        if id.is_empty() {
            continue;
        }
        let name_color = if id == current {
            &colors.active
        } else {
            &colors.inactive
        };

        list.text.push_str(&format!("#[range=session|{id}]"));
        let mut icon_width = 0;
        if let Some(color) = lookup.session_color.get(id) {
            let icon = blink_icon(frame);
            list.text.push_str(&format!("#[fg={color}]{icon}"));
            icon_width = icon.chars().count();
        }
        list.text
            .push_str(&format!("#[fg={name_color}]{name}  #[norange]"));
        list.width += icon_width + name.chars().count() + 2;
    }
    list
}

fn window_list_width(list_output: &str, lookup: &NoticeLookup, session_windows: i64) -> i64 {
    let mut total = 0;
    for line in list_output.lines() {
        let mut it = line.splitn(3, FIELD_SEPARATOR);
        let (id, index, name) = (
            it.next().unwrap_or(""),
            it.next().unwrap_or(""),
            it.next().unwrap_or(""),
        );
        total += index.chars().count() as i64 + 2;
        if name != "Window" {
            total += name.chars().count() as i64 + 1;
        }
        if lookup.windows.contains(id) {
            total += 1;
        }
    }
    if session_windows > 1 {
        total += session_windows - 1;
    }
    total
}

/// Prefer a true absolute centre; when the session list would collide with the
/// centred window list, use tmux's non-overlapping centre instead.
fn target_justify(client_width: i64, window_width: i64, session_width: i64) -> &'static str {
    const LEFT_PREFIX_WIDTH: i64 = 6;
    let safe_left_limit = client_width / 2 - (window_width + 1) / 2 - 1;
    if LEFT_PREFIX_WIDTH + session_width > safe_left_limit {
        "centre"
    } else {
        "absolute-centre"
    }
}

fn parse_uint(s: &str) -> Option<i64> {
    if s.bytes().all(|b| b.is_ascii_digit()) {
        s.parse().ok()
    } else {
        None
    }
}

fn update_justify(inputs: &Inputs, lookup: &NoticeLookup, session_width: usize) {
    let width = parse_uint(if inputs.client_width.is_empty() {
        "0"
    } else {
        inputs.client_width
    });
    let (Some(width), Some(windows)) = (width, parse_uint(inputs.session_windows)) else {
        return;
    };
    if windows <= 1 {
        return;
    }

    let current = inputs.current;
    let list = tmux::output(&[
        "list-windows",
        "-t",
        current,
        "-F",
        "#{window_id}\u{1f}#{window_index}\u{1f}#{window_name}",
    ]);
    let window_width = window_list_width(&list, lookup, windows);
    let target = target_justify(width, window_width, session_width as i64);
    let current_justify = tmux::capture(&["show-options", "-qv", "-t", current, "status-justify"]);
    if current_justify != target {
        tmux::quiet(&["set-option", "-q", "-t", current, "status-justify", target]);
    }
}

pub fn run(inputs: &Inputs, frame: u64) -> String {
    let lookup = NoticeLookup::query(&env("TMUX_STATUS_NOTICE_BRIGHT"));
    let colors = Colors {
        active: env("TMUX_STATUS_SESSION_ACTIVE"),
        inactive: env("TMUX_STATUS_SESSION_INACTIVE"),
    };
    let list = render_sessions(
        &tmux::output(&["list-sessions", "-F", "#{session_id}\u{1f}#{session_name}"]),
        inputs.current,
        &lookup,
        frame,
        &colors,
    );
    update_justify(inputs, &lookup, list.width);
    list.text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notice_pane_lookup() {
        let out = "$1\u{1f}@1\u{1f}\u{1f}\n$1\u{1f}@2\u{1f}done\u{1f}colour9\n$1\u{1f}@3\u{1f}x\u{1f}\n$2\u{1f}@4\u{1f}y\u{1f}\n";
        let l = NoticeLookup::parse(out, "bright");
        assert_eq!(l.session_color["$1"], "colour9");
        assert_eq!(l.session_color["$2"], "bright");
        assert!(l.windows.contains("@2") && l.windows.contains("@3") && l.windows.contains("@4"));
        assert!(!l.windows.contains("@1"));
    }

    #[test]
    fn sessions_render() {
        let lookup = NoticeLookup::parse("$2\u{1f}@4\u{1f}y\u{1f}\n", "bright");
        let colors = Colors {
            active: "white".to_string(),
            inactive: "grey".to_string(),
        };
        let list = "$1\u{1f}main\n$2\u{1f}work\n";
        let out = render_sessions(list, "$1", &lookup, 2, &colors);
        assert_eq!(
            out.text,
            "#[range=session|$1]#[fg=white]main  #[norange]#[range=session|$2]#[fg=bright]•#[fg=grey]work  #[norange]"
        );
        assert_eq!(out.width, 6 + 1 + 4 + 2);
        let out = render_sessions(list, "$1", &lookup, 3, &colors);
        assert!(out.text.contains("#[fg=bright] #[fg=grey]work"));
    }

    #[test]
    fn window_widths_and_justify() {
        let lookup = NoticeLookup::parse("$1\u{1f}@2\u{1f}y\u{1f}\n", "b");
        let list = "@1\u{1f}1\u{1f}Window\n@2\u{1f}10\u{1f}vim\n";
        assert_eq!(window_list_width(list, &lookup, 2), 3 + 9 + 1);
        assert_eq!(target_justify(100, 13, 36), "absolute-centre");
        assert_eq!(target_justify(100, 13, 37), "centre");
        assert_eq!(target_justify(0, 13, 0), "centre");
    }

    #[test]
    fn uint_parsing() {
        assert_eq!(parse_uint("120"), Some(120));
        assert_eq!(parse_uint("-1"), None);
        assert_eq!(parse_uint("1x"), None);
    }
}
