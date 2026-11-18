use crate::format::{format_age, format_clock, format_duration, format_turn_time};
use crate::js;
use crate::model::{Agent, EntryKind, LogEntry, Session, SessionStatus};
use crate::sessions::{SessionRow, home_dir};
use crate::text::{pad, truncate, width as display_width, wrap};

const RESET: &str = "\u{1b}[0m";

pub fn bold(text: &str) -> String {
    format!("\u{1b}[1m{text}{RESET}")
}

pub fn dim(text: &str) -> String {
    format!("\u{1b}[2m{text}{RESET}")
}

#[derive(Clone, Copy)]
pub struct Rgb(u8, u8, u8);

impl Rgb {
    pub fn paint(self, text: &str) -> String {
        let Self(r, g, b) = self;
        format!("\u{1b}[38;2;{r};{g};{b}m{text}{RESET}")
    }
}

pub const GREEN: Rgb = Rgb(163, 190, 140);
pub const YELLOW: Rgb = Rgb(235, 203, 139);
const BLUE: Rgb = Rgb(129, 161, 193);
const RED: Rgb = Rgb(191, 97, 106);
const MAGENTA: Rgb = Rgb(180, 142, 173);
const GRAY: Rgb = Rgb(128, 128, 128);

impl Agent {
    fn color(self) -> Rgb {
        match self {
            Self::Claude => Rgb(208, 135, 112),
            Self::Codex => Rgb(136, 192, 208),
            Self::Pi => Rgb(180, 142, 173),
        }
    }
}

impl SessionStatus {
    fn color(self) -> Rgb {
        match self {
            Self::Running => GREEN,
            Self::Waiting => YELLOW,
            Self::Idle => BLUE,
            Self::Ended | Self::Unknown => GRAY,
        }
    }
}

struct KindStyle {
    label: &'static str,
    max_lines: usize,
    paint: fn(&str) -> String,
}

impl EntryKind {
    fn style(self) -> KindStyle {
        let (label, max_lines, paint): (_, _, fn(&str) -> String) = match self {
            Self::User => ("USER", 10, |text| bold(&GREEN.paint(text))),
            Self::Assistant => ("AI", 16, str::to_string),
            Self::Thinking => ("THINK", 4, dim),
            Self::Tool => ("TOOL", 4, |text| YELLOW.paint(text)),
            Self::Result => ("OUT", 3, dim),
            Self::Error => ("ERROR", 6, |text| RED.paint(text)),
            Self::Status => ("──", 1, |text| MAGENTA.paint(text)),
        };
        KindStyle {
            label,
            max_lines,
            paint,
        }
    }
}

pub fn project_name(cwd: &str) -> &str {
    match js::basename(cwd) {
        "" => cwd,
        name => name,
    }
}

fn agent_tag(agent: Agent) -> String {
    agent.color().paint(&pad(agent.as_str(), AGENT_WIDTH))
}

fn status_tag(status: SessionStatus) -> String {
    status.color().paint(&pad(status.as_str(), STATUS_WIDTH))
}

/// Drop the vendor prefix so model names fit a narrow column.
fn short_model(model: Option<&str>) -> &str {
    let model = model.unwrap_or("-");
    model.strip_prefix("claude-").unwrap_or(model)
}

const AGENT_WIDTH: usize = 6;
const STATUS_WIDTH: usize = 7;
const MODEL_WIDTH: usize = 14;
const TIME_WIDTH: usize = 6;

fn tree_width(width: usize) -> usize {
    (width * 38 / 100).clamp(24, 64)
}

fn last_width(width: usize) -> Option<usize> {
    let fixed = 2
        + tree_width(width)
        + 1
        + AGENT_WIDTH
        + 1
        + STATUS_WIDTH
        + 1
        + MODEL_WIDTH
        + 1
        + TIME_WIDTH
        + 1;
    width.checked_sub(fixed).filter(|rest| *rest > 8)
}

fn home_relative(path: &str) -> String {
    let home = home_dir();
    let home = home.to_string_lossy();
    match path.strip_prefix(home.as_ref()) {
        Some(rest) if rest.is_empty() || rest.starts_with('/') => format!("~{rest}"),
        _ => path.to_string(),
    }
}

pub fn render_column_header(width: usize) -> String {
    dim(&[
        "  ",
        &pad("PROJECT / SESSION", tree_width(width)),
        " ",
        &pad("AGENT", AGENT_WIDTH),
        " ",
        &pad("STATUS", STATUS_WIDTH),
        " ",
        &pad("MODEL", MODEL_WIDTH),
        " ",
        &js::pad_start("TIME", TIME_WIDTH),
        " ",
        if last_width(width).is_some() {
            "LAST"
        } else {
            ""
        },
    ]
    .concat())
}

pub fn render_project_row(cwd: &str, sessions: usize, width: usize) -> String {
    let name = project_name(cwd);
    let plural = if sessions == 1 { "" } else { "s" };
    let detail = format!("{} · {sessions} session{plural}", home_relative(cwd));
    let detail_width = width.saturating_sub(display_width(name) + 4);
    format!(
        "  {}  {}",
        bold(name),
        dim(&truncate(&detail, detail_width))
    )
}

pub fn render_session_row(row: &SessionRow, selected: bool, width: usize, now: f64) -> String {
    let session = &row.session;
    let is_child = row.depth > 0;
    let muted = |text: &str| -> String {
        if session.status == SessionStatus::Ended {
            dim(text)
        } else {
            text.to_string()
        }
    };
    let guide = truncate(&row.tree, tree_width(width));
    let title = pad(
        &session.title,
        tree_width(width).saturating_sub(display_width(&guide)),
    );
    let turn_time = format_turn_time(session.turn_elapsed(now));
    [
        if selected { bold("▶ ") } else { "  ".into() },
        dim(&guide),
        if selected || !is_child {
            bold(&title)
        } else {
            muted(&title)
        },
        " ".into(),
        // Subagents inherit the parent's agent, so their column stays blank.
        session.agent.color().paint(&pad(
            if is_child { "" } else { session.agent.as_str() },
            AGENT_WIDTH,
        )),
        " ".into(),
        status_tag(session.status),
        " ".into(),
        muted(&pad(short_model(session.model.as_deref()), MODEL_WIDTH)),
        " ".into(),
        muted(&js::pad_start(&turn_time, TIME_WIDTH)),
        " ".into(),
        last_width(width).map_or_else(String::new, |rest| {
            dim(&truncate(session.last.as_deref().unwrap_or(""), rest))
        }),
    ]
    .concat()
}

pub fn render_empty(window_ms: f64, hidden_idle: usize) -> Vec<String> {
    let message = if hidden_idle > 0 {
        let plural = if hidden_idle == 1 { "" } else { "s" };
        format!("  {hidden_idle} idle session{plural} hidden. Press i to show.")
    } else {
        format!(
            "  No live Claude sessions or Codex/pi sessions active in the last {}.",
            format_age(window_ms)
        )
    };
    vec![String::new(), dim(&message)]
}

pub fn render_session_header(session: &Session, now: f64) -> String {
    let turn_time = session
        .turn_elapsed(now)
        .map(|elapsed| format!("turn time {}", format_duration(elapsed)));
    let mut details = session.cwd.clone();
    if let Some(turn_time) = turn_time {
        details.push_str(" · ");
        details.push_str(&turn_time);
    }
    [
        agent_tag(session.agent),
        " ".into(),
        status_tag(session.status),
        " ".into(),
        short_model(session.model.as_deref()).into(),
        "  ".into(),
        bold(&session.title),
        "  ".into(),
        dim(&details),
    ]
    .concat()
}

const PREFIX_WIDTH: usize = 16;

fn collapse_blank_lines(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut newlines = 0;
    for char in text.chars() {
        if char == '\n' {
            newlines += 1;
            continue;
        }
        out.push_str(&"\n\n"[..newlines.min(2)]);
        newlines = 0;
        out.push(char);
    }
    out.push_str(&"\n\n"[..newlines.min(2)]);
    out
}

fn entry_body(entry: &LogEntry) -> String {
    let text = match entry.non_empty_title() {
        Some(title) if entry.text.is_empty() => title.to_string(),
        Some(title) => format!("{title} {}", entry.text),
        None => entry.text.clone(),
    };
    js::trim(&collapse_blank_lines(&text)).to_string()
}

/// Render log entries into lines that fit `width`. `continued` marks entries
/// appended after existing lines; it only affects the blank line before a
/// user prompt, so appended output renders exactly as a full re-render would.
pub fn render_entries(entries: &[LogEntry], width: usize, continued: bool) -> Vec<String> {
    let body_width = width.saturating_sub(PREFIX_WIDTH).max(10);
    let mut lines = Vec::new();
    for entry in entries {
        let body = entry_body(entry);
        if body.is_empty() {
            continue;
        }
        let style = entry.kind.style();
        if entry.kind == EntryKind::User && (continued || !lines.is_empty()) {
            lines.push(String::new());
        }
        let wrapped = wrap(&body, body_width);
        let shown = wrapped.len().min(style.max_lines);
        let clock = entry.time.map_or_else(|| " ".repeat(8), format_clock);
        let first_prefix = format!("{} {} ", dim(&clock), (style.paint)(&pad(style.label, 6)));
        let continuation_prefix = " ".repeat(PREFIX_WIDTH);
        for (index, line) in wrapped[..shown].iter().enumerate() {
            let prefix = if index == 0 {
                &first_prefix
            } else {
                &continuation_prefix
            };
            lines.push(format!("{prefix}{}", (style.paint)(line)));
        }
        if wrapped.len() > shown {
            let hidden = wrapped.len() - shown;
            lines.push(format!(
                "{continuation_prefix}{}",
                dim(&format!("… +{hidden} lines"))
            ));
        }
    }
    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_appended_entries_exactly_as_a_full_re_render() {
        let entries = [
            LogEntry::new(None, EntryKind::User, "first"),
            LogEntry::new(None, EntryKind::Assistant, "answer"),
            LogEntry::new(None, EntryKind::User, "second"),
            LogEntry::titled(None, EntryKind::Tool, "Bash", "$ ls"),
        ];
        let (head, tail) = entries.split_at(2);
        let mut appended = render_entries(head, 80, false);
        appended.extend(render_entries(tail, 80, true));
        assert_eq!(appended, render_entries(&entries, 80, false));
    }
}
