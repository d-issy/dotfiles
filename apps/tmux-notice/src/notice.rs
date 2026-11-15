//! `tmux-notice`: pane-local notice helper.

use crate::tmux;
use regex::Regex;
use serde::Deserialize;
use std::collections::BTreeMap;

const USAGE: &str = "tmux-notice - pane-local tmux notice helper

Usage:
  tmux-notice on <notice> [-t <pane>]
  tmux-notice off [notice] [-t <pane>]
  tmux-notice clear [--pane|--window|--session|--all] [-t <target>]
  tmux-notice list

Notices are configured by dot.programs.scripts.tmuxNotice.notices.
";

#[derive(Deserialize, Default, Clone)]
#[serde(default, rename_all = "camelCase")]
struct Notice {
    icons: Option<Vec<String>>,
    title: Option<String>,
    session_notification_indicator_color: Option<String>,
    title_mode: Option<String>,
    title_strip_patterns: Option<Vec<String>>,
    pane_title: Option<PaneTitle>,
}

#[derive(Deserialize, Default, Clone)]
#[serde(default, rename_all = "camelCase")]
struct PaneTitle {
    enable: Option<bool>,
    template: Option<String>,
    // Parsed for completeness; see `on_notice` for why it has no effect.
    #[allow(dead_code)]
    restore_on_clear: Option<bool>,
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct Config {
    fallback: Notice,
    notices: BTreeMap<String, Notice>,
}

fn load_config() -> Result<Config, String> {
    let path = std::env::var("TMUX_NOTICE_CONFIG")
        .map_err(|_| "tmux-notice: TMUX_NOTICE_CONFIG is not set".to_string())?;
    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("tmux-notice: cannot read {path}: {e}"))?;
    serde_json::from_str(&text).map_err(|e| format!("tmux-notice: invalid config {path}: {e}"))
}

struct Parsed {
    target: String,
    args: Vec<String>,
}

enum ParseOutcome {
    Ok(Parsed),
    Help,
    Error(String),
}

fn parse_target(argv: &[String]) -> ParseOutcome {
    let mut target = String::new();
    let mut args = Vec::new();
    let mut i = 0;
    while i < argv.len() {
        match argv[i].as_str() {
            "-t" | "--target" => {
                if i + 1 >= argv.len() {
                    return ParseOutcome::Error(format!(
                        "tmux-notice: missing target after {}",
                        argv[i]
                    ));
                }
                target = argv[i + 1].clone();
                i += 2;
            }
            "-h" | "--help" => return ParseOutcome::Help,
            "--" => {
                args.extend(argv[i + 1..].iter().cloned());
                break;
            }
            other => {
                args.push(other.to_string());
                i += 1;
            }
        }
    }
    ParseOutcome::Ok(Parsed { target, args })
}

fn resolve_target(target: &str) -> Option<String> {
    if !target.is_empty() {
        return Some(target.to_string());
    }
    match std::env::var("TMUX_PANE") {
        Ok(p) if !p.is_empty() => Some(p),
        _ => None,
    }
}

fn get_option(pane: &str, option: &str) -> String {
    tmux::capture(&["show-option", "-p", "-t", pane, "-v", option])
}

fn set_option(pane: &str, option: &str, value: &str) {
    tmux::quiet(&["set-option", "-p", "-t", pane, option, value]);
}

fn set_pane_title(pane: &str, title: &str) {
    tmux::quiet(&["select-pane", "-t", pane, "-T", title]);
}

fn refresh_status() {
    tmux::quiet(&["refresh-client", "-S"]);
}

/// Matches `^1:1:[1-9][0-9]*$` on `pane_active:window_active:session_attached`.
fn is_visible_active(s: &str) -> bool {
    let parts: Vec<&str> = s.split(':').collect();
    match parts.as_slice() {
        ["1", "1", attached] => {
            let mut chars = attached.chars();
            matches!(chars.next(), Some('1'..='9')) && chars.all(|c| c.is_ascii_digit())
        }
        _ => false,
    }
}

fn clear_target(pane: &str) {
    let has_original = get_option(pane, "@tmux_notice_has_original_title");
    let original_title = get_option(pane, "@tmux_notice_original_title");
    let restore_title = get_option(pane, "@tmux_notice_restore_title");

    if has_original == "1" && restore_title == "1" {
        set_pane_title(pane, &original_title);
    }

    for option in [
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
    ] {
        set_option(pane, option, "");
    }
}

fn clear_panes(panes: &[String]) {
    for pane in panes.iter().filter(|p| !p.is_empty()) {
        clear_target(pane);
    }
    refresh_status();
}

fn display_format(target: &str, format: &str) -> String {
    match resolve_target(target) {
        Some(t) => tmux::capture(&["display-message", "-p", "-t", &t, format]),
        None => tmux::capture(&["display-message", "-p", format]),
    }
}

fn list_panes(args: &[&str]) -> Vec<String> {
    let mut full = vec!["list-panes"];
    full.extend_from_slice(args);
    full.extend_from_slice(&["-F", "#{pane_id}"]);
    tmux::output(&full).lines().map(str::to_string).collect()
}

fn clear_notices(target: &str, args: &[String]) -> u8 {
    let mut scope = "window";
    for arg in args {
        match arg.as_str() {
            "--pane" => scope = "pane",
            "--window" => scope = "window",
            "--session" => scope = "session",
            "--all" => scope = "all",
            other => {
                eprintln!("tmux-notice: unknown clear option: {other}");
                return 2;
            }
        }
    }

    match scope {
        "pane" => {
            if let Some(pane) = resolve_target(target) {
                clear_panes(&[pane]);
            }
        }
        "window" => {
            let window = display_format(target, "#{window_id}");
            if !window.is_empty() {
                clear_panes(&list_panes(&["-t", &window]));
            }
        }
        "session" => {
            let session = display_format(target, "#{session_id}");
            if !session.is_empty() {
                clear_panes(&list_panes(&["-s", "-t", &session]));
            }
        }
        _ => clear_panes(&list_panes(&["-a"])),
    }
    0
}

fn strip_patterns(notice: &Notice, value: &str) -> Result<String, String> {
    let mut out = value.to_string();
    for pattern in notice.title_strip_patterns.iter().flatten() {
        let re = Regex::new(pattern).map_err(|e| {
            format!("tmux-notice: invalid titleStripPatterns entry {pattern:?}: {e}")
        })?;
        // jq `sub` replaces only the first match.
        out = re.replace(&out, regex::NoExpand("")).into_owned();
    }
    Ok(out)
}

fn notice_title(notice: &Notice, current: &str, name: &str) -> Result<String, String> {
    let fallback_title = notice.title.as_deref().unwrap_or(name);
    match notice.title_mode.as_deref().unwrap_or("current") {
        "none" => Ok(String::new()),
        "name" => strip_patterns(notice, name),
        "notice" => strip_patterns(notice, fallback_title),
        _ => {
            let stripped = strip_patterns(notice, current)?;
            if stripped.is_empty() {
                strip_patterns(notice, fallback_title)
            } else {
                Ok(stripped)
            }
        }
    }
}

fn render_template(template: &str, icon: &str, title: &str, name: &str) -> String {
    template
        .replace("{icon}", icon)
        .replace("{title}", title)
        .replace("{name}", name)
}

fn first_icon(notice: &Notice) -> String {
    match notice.icons.as_deref() {
        Some([first, ..]) => first.clone(),
        _ => "•".to_string(),
    }
}

fn joined_icons(notice: &Notice) -> String {
    match notice.icons.as_deref() {
        Some(icons) if !icons.is_empty() => icons.join("|"),
        _ => "•".to_string(),
    }
}

fn on_notice(target: &str, name: &str) -> u8 {
    let Some(pane) = resolve_target(target) else {
        return 0;
    };

    let active = tmux::capture(&[
        "display-message",
        "-p",
        "-t",
        &pane,
        "#{pane_active}:#{window_active}:#{session_attached}",
    ]);
    if is_visible_active(&active) {
        return 0;
    }

    let config = match load_config() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("{e}");
            return 1;
        }
    };
    let notice = config.notices.get(name).unwrap_or(&config.fallback);
    let current_title = tmux::capture(&["display-message", "-p", "-t", &pane, "#{pane_title}"]);
    let title = match notice_title(notice, &current_title, name) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("{e}");
            return 5;
        }
    };

    let icon = first_icon(notice);
    let icons = joined_icons(notice);
    let color = notice
        .session_notification_indicator_color
        .as_deref()
        .unwrap_or("");
    let pane_title = notice.pane_title.clone().unwrap_or_default();
    let pane_title_enabled = pane_title.enable.unwrap_or(false);
    let template = pane_title.template.as_deref().unwrap_or("{icon} {title}");

    if get_option(&pane, "@tmux_notice_has_original_title") != "1" {
        set_option(&pane, "@tmux_notice_original_title", &current_title);
        set_option(&pane, "@tmux_notice_has_original_title", "1");
    }

    set_option(&pane, "@tmux_notice_name", name);
    set_option(&pane, "@tmux_notice_icons", &icons);
    set_option(
        &pane,
        "@tmux_notice_session_notification_indicator_color",
        color,
    );
    set_option(&pane, "@tmux_notice_session_indicator_color", "");
    set_option(&pane, "@tmux_notice_color", "");
    set_option(&pane, "@status_notice_icon", &icon);
    set_option(&pane, "@pane_notice_icon", &icon);
    set_option(&pane, "@pane_notice_title", &title);

    if pane_title_enabled {
        set_pane_title(&pane, &render_template(template, &icon, &title, name));
        // The shell version computed this with jq's `.restoreOnClear // true`,
        // which yields true even when the option is false, so the restore flag
        // is always set. Kept as-is for parity.
        set_option(&pane, "@tmux_notice_restore_title", "1");
    }

    refresh_status();
    0
}

fn off_notice(target: &str, expected: &str) -> u8 {
    let Some(pane) = resolve_target(target) else {
        return 0;
    };
    if !expected.is_empty() && get_option(&pane, "@tmux_notice_name") != expected {
        return 0;
    }
    clear_target(&pane);
    refresh_status();
    0
}

fn icon_label(icon: &str) -> String {
    if !icon.is_empty() && icon.chars().all(|c| c == ' ') {
        "(blank)".to_string()
    } else if icon.is_empty() {
        "(empty)".to_string()
    } else {
        icon.to_string()
    }
}

/// Mirrors jq's `@tsv` escaping, which the shell version printed verbatim.
fn tsv_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\t' => out.push_str("\\t"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            c => out.push(c),
        }
    }
    out
}

fn list_row(name: &str, notice: &Notice) -> [String; 6] {
    let patterns = notice.title_strip_patterns.as_deref().unwrap_or(&[]);
    let strip = if patterns.is_empty() {
        "-".to_string()
    } else {
        patterns
            .iter()
            .map(|p| format!("/{p}/"))
            .collect::<Vec<_>>()
            .join(", ")
    };
    let pane_title = if notice.pane_title.as_ref().and_then(|p| p.enable) == Some(true) {
        "set"
    } else {
        "unchanged"
    };
    let animation = notice
        .icons
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .map(|i| icon_label(i))
        .collect::<Vec<_>>()
        .join(" -> ");
    [
        tsv_escape(name),
        tsv_escape(notice.title_mode.as_deref().unwrap_or("current")),
        pane_title.to_string(),
        tsv_escape(
            notice
                .session_notification_indicator_color
                .as_deref()
                .unwrap_or("-"),
        ),
        tsv_escape(&strip),
        tsv_escape(&animation),
    ]
}

fn pad(value: &str, width: usize) -> String {
    let len = value.chars().count();
    format!("{value}{}", " ".repeat(width.saturating_sub(len)))
}

fn list_line(cols: [&str; 6], strip_width: usize) -> String {
    format!(
        "{}  {}  {}  {}  {}  {}\n",
        pad(cols[0], 16),
        pad(cols[1], 8),
        pad(cols[2], 10),
        pad(cols[3], 7),
        pad(cols[4], strip_width),
        cols[5]
    )
}

fn format_list(config: &Config) -> String {
    let mut rows: Vec<[String; 6]> = config
        .notices
        .iter()
        .map(|(name, notice)| list_row(name, notice))
        .collect();
    rows.push(list_row("<fallback>", &config.fallback));

    let strip_width = rows
        .iter()
        .map(|r| r[4].chars().count())
        .fold(5, usize::max);

    let mut out = String::from("Usage: tmux-notice on <notice>\n\n");
    out.push_str(&list_line(
        [
            "notice",
            "title",
            "paneTitle",
            "session",
            "strip",
            "animation",
        ],
        strip_width,
    ));
    out.push_str(&list_line(
        [
            "----------------",
            "--------",
            "----------",
            "-------",
            &"-".repeat(strip_width),
            "---------",
        ],
        strip_width,
    ));
    for row in &rows {
        out.push_str(&list_line(
            [&row[0], &row[1], &row[2], &row[3], &row[4], &row[5]],
            strip_width,
        ));
    }
    out
}

pub fn run(argv: &[String]) -> u8 {
    let Some(command) = argv.first() else {
        eprint!("{USAGE}");
        return 2;
    };

    let parsed = match parse_target(&argv[1..]) {
        ParseOutcome::Ok(p) => p,
        ParseOutcome::Help => {
            print!("{USAGE}");
            return 0;
        }
        ParseOutcome::Error(msg) => {
            eprintln!("{msg}");
            return 2;
        }
    };

    match command.as_str() {
        "on" => match parsed.args.first() {
            Some(name) => on_notice(&parsed.target, name),
            None => {
                eprintln!("tmux-notice: missing notice name");
                2
            }
        },
        "off" => off_notice(
            &parsed.target,
            parsed.args.first().map(String::as_str).unwrap_or(""),
        ),
        "clear" => clear_notices(&parsed.target, &parsed.args),
        "list" => match load_config() {
            Ok(config) => {
                print!("{}", format_list(&config));
                0
            }
            Err(e) => {
                eprintln!("{e}");
                1
            }
        },
        "-h" | "--help" | "help" => {
            print!("{USAGE}");
            0
        }
        other => {
            eprintln!("tmux-notice: unknown command: {other}");
            eprint!("{USAGE}");
            2
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn notice(json: &str) -> Notice {
        serde_json::from_str(json).unwrap()
    }

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
    fn title_modes() {
        let n = notice(
            r#"{"titleMode":"current","titleStripPatterns":["^pi - ","\\s+$"],"title":"Fallback"}"#,
        );
        assert_eq!(notice_title(&n, "pi - work  ", "done").unwrap(), "work");
        assert_eq!(notice_title(&n, "pi - ", "done").unwrap(), "Fallback");
        let n = notice(r#"{"titleMode":"name","titleStripPatterns":["^x-"]}"#);
        assert_eq!(notice_title(&n, "cur", "x-done").unwrap(), "done");
        let n = notice(r#"{"titleMode":"notice","title":"Hello"}"#);
        assert_eq!(notice_title(&n, "cur", "done").unwrap(), "Hello");
        let n = notice(r#"{"titleMode":"notice"}"#);
        assert_eq!(notice_title(&n, "cur", "done").unwrap(), "done");
        let n = notice(r#"{"titleMode":"none","title":"x"}"#);
        assert_eq!(notice_title(&n, "cur", "done").unwrap(), "");
        // Default mode is "current".
        let n = notice("{}");
        assert_eq!(notice_title(&n, "cur", "done").unwrap(), "cur");
    }

    #[test]
    fn strip_replaces_first_match_only() {
        let n = notice(r#"{"titleStripPatterns":["a"]}"#);
        assert_eq!(strip_patterns(&n, "banana").unwrap(), "bnana");
    }

    #[test]
    fn template_rendering() {
        assert_eq!(
            render_template("{icon} {title} [{name}]", "•", "T", "done"),
            "• T [done]"
        );
    }

    #[test]
    fn icons() {
        let n = notice(r#"{"icons":["a","b"]}"#);
        assert_eq!(first_icon(&n), "a");
        assert_eq!(joined_icons(&n), "a|b");
        let n = notice(r#"{"icons":[]}"#);
        assert_eq!(first_icon(&n), "•");
        assert_eq!(joined_icons(&n), "•");
        assert_eq!(first_icon(&notice("{}")), "•");
    }

    #[test]
    fn target_parsing() {
        let argv: Vec<String> = ["done", "-t", "%3", "--", "-t", "x"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        let ParseOutcome::Ok(p) = parse_target(&argv) else {
            panic!()
        };
        assert_eq!(p.target, "%3");
        assert_eq!(p.args, ["done", "-t", "x"]);
        assert!(matches!(
            parse_target(&["-t".to_string()]),
            ParseOutcome::Error(m) if m == "tmux-notice: missing target after -t"
        ));
        assert!(matches!(
            parse_target(&["-h".to_string()]),
            ParseOutcome::Help
        ));
    }

    #[test]
    fn list_output() {
        let config: Config = serde_json::from_str(
            r#"{
              "fallback": {"icons": ["•"], "titleMode": "name"},
              "notices": {
                "done": {"icons": ["✓", " ", ""], "titleMode": "current",
                         "sessionNotificationIndicatorColor": "colour2",
                         "titleStripPatterns": ["^\\s+", "x"],
                         "paneTitle": {"enable": true}}
              }
            }"#,
        )
        .unwrap();
        let expected = "\
Usage: tmux-notice on <notice>

notice            title     paneTitle   session  strip         animation
----------------  --------  ----------  -------  ------------  ---------
done              current   set         colour2  /^\\\\s+/, /x/  ✓ -> (blank) -> (empty)
<fallback>        name      unchanged   -        -             •
";
        assert_eq!(format_list(&config), expected);
    }

    #[test]
    fn tsv_escaping() {
        assert_eq!(tsv_escape("a\\b\tc"), "a\\\\b\\tc");
    }
}
