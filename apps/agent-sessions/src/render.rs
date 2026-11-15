use crate::sessions::{SessionRow, home_string, project_basename, session_runtime};
use crate::text::{
    format_age, format_clock, format_duration, pad, pad_start, truncate, width as display_width,
    wrap,
};
use crate::types::{Agent, EntryKind, LogEntry, Session, SessionStatus};

const RESET: &str = "\u{1b}[0m";

pub type Rgb = [u8; 3];

pub fn bold(text: &str) -> String {
    format!("\u{1b}[1m{text}{RESET}")
}

pub fn dim(text: &str) -> String {
    format!("\u{1b}[2m{text}{RESET}")
}

pub fn color(rgb: Rgb, text: &str) -> String {
    format!("\u{1b}[38;2;{};{};{}m{text}{RESET}", rgb[0], rgb[1], rgb[2])
}

pub const CLAUDE: Rgb = [208, 135, 112];
pub const CODEX: Rgb = [136, 192, 208];
pub const GREEN: Rgb = [163, 190, 140];
pub const YELLOW: Rgb = [235, 203, 139];
pub const BLUE: Rgb = [129, 161, 193];
pub const RED: Rgb = [191, 97, 106];
pub const MAGENTA: Rgb = [180, 142, 173];
pub const GRAY: Rgb = [128, 128, 128];

fn agent_color(agent: Agent) -> Rgb {
    match agent {
        Agent::Claude => CLAUDE,
        Agent::Codex => CODEX,
    }
}

fn status_color(status: SessionStatus) -> Rgb {
    match status {
        SessionStatus::Running => GREEN,
        SessionStatus::Waiting => YELLOW,
        SessionStatus::Idle => BLUE,
        SessionStatus::Ended | SessionStatus::Unknown => GRAY,
    }
}

struct KindStyle {
    label: &'static str,
    max_lines: usize,
    paint: fn(&str) -> String,
}

fn kind_style(kind: EntryKind) -> KindStyle {
    match kind {
        EntryKind::User => KindStyle {
            label: "USER",
            max_lines: 10,
            paint: |text| bold(&color(GREEN, text)),
        },
        EntryKind::Assistant => KindStyle {
            label: "AI",
            max_lines: 16,
            paint: str::to_string,
        },
        EntryKind::Thinking => KindStyle {
            label: "THINK",
            max_lines: 4,
            paint: dim,
        },
        EntryKind::Tool => KindStyle {
            label: "TOOL",
            max_lines: 4,
            paint: |text| color(YELLOW, text),
        },
        EntryKind::Result => KindStyle {
            label: "OUT",
            max_lines: 3,
            paint: dim,
        },
        EntryKind::Error => KindStyle {
            label: "ERROR",
            max_lines: 6,
            paint: |text| color(RED, text),
        },
        EntryKind::Status => KindStyle {
            label: "──",
            max_lines: 1,
            paint: |text| color(MAGENTA, text),
        },
    }
}

pub fn project_name(cwd: &str) -> &str {
    match project_basename(cwd) {
        "" => cwd,
        name => name,
    }
}

pub fn agent_tag(agent: Agent) -> String {
    color(agent_color(agent), &pad(agent.as_str(), 6))
}

pub fn status_tag(status: SessionStatus) -> String {
    color(status_color(status), &pad(status.as_str(), 7))
}

/// Drop the vendor prefix so model names fit a narrow column.
pub fn short_model(model: Option<&str>) -> &str {
    let model = model.unwrap_or("-");
    model.strip_prefix("claude-").unwrap_or(model)
}

const AGENT_WIDTH: i64 = 6;
const STATUS_WIDTH: i64 = 7;
const MODEL_WIDTH: i64 = 14;
const TIME_WIDTH: usize = 6;
const AGE_WIDTH: usize = 7;

/// Width of the tree column holding guides plus the session title.
fn tree_width(width: i64) -> i64 {
    ((width as f64 * 0.38).floor() as i64).clamp(24, 64)
}

fn last_width(width: i64) -> i64 {
    width
        - (2 + tree_width(width) + 1 + AGENT_WIDTH + 1 + STATUS_WIDTH + 1)
        - (MODEL_WIDTH + 1 + TIME_WIDTH as i64 + 1 + AGE_WIDTH as i64 + 1)
}

fn home_relative(path: &str) -> String {
    let home = home_string();
    if path == home || path.starts_with(&format!("{home}/")) {
        format!("~{}", &path[home.len()..])
    } else {
        path.to_string()
    }
}

/// Column labels aligned with `render_session_row`.
pub fn render_column_header(width: i64) -> String {
    let rest = last_width(width);
    dim(&[
        "  ".to_string(),
        pad("PROJECT / SESSION", tree_width(width)),
        " ".into(),
        pad("AGENT", AGENT_WIDTH),
        " ".into(),
        pad("STATUS", STATUS_WIDTH),
        " ".into(),
        pad("MODEL", MODEL_WIDTH),
        " ".into(),
        pad_start("TIME", TIME_WIDTH),
        " ".into(),
        pad_start("UPDATED", AGE_WIDTH),
        " ".into(),
        if rest > 8 { "LAST" } else { "" }.into(),
    ]
    .concat())
}

pub fn render_project_row(cwd: &str, sessions: usize, width: i64) -> String {
    let name = project_name(cwd);
    let detail = format!(
        "{} · {sessions} session{}",
        home_relative(cwd),
        if sessions == 1 { "" } else { "s" }
    );
    format!(
        "  {}  {}",
        bold(name),
        dim(&truncate(
            &detail,
            (width - display_width(name) as i64 - 4).max(0)
        ))
    )
}

pub fn render_session_row(row: &SessionRow<'_>, selected: bool, width: i64, now: f64) -> String {
    let session = row.session;
    let is_child = row.depth > 0;
    let muted = |text: &str| -> String {
        if session.status == SessionStatus::Ended {
            dim(text)
        } else {
            text.to_string()
        }
    };
    let runtime = session_runtime(session, now);
    let rest = last_width(width);
    // The tree column is guides followed by the title; agent is just an attribute.
    let guide = truncate(row.tree, tree_width(width));
    let title = pad(
        &session.title,
        (tree_width(width) - display_width(&guide) as i64).max(0),
    );
    [
        if selected { bold("▶ ") } else { "  ".into() },
        dim(&guide),
        if selected || !is_child {
            bold(&title)
        } else {
            muted(&title)
        },
        " ".into(),
        // Subagents inherit the parent's agent, so leave it blank.
        color(
            agent_color(session.agent),
            &pad(
                if is_child { "" } else { session.agent.as_str() },
                AGENT_WIDTH,
            ),
        ),
        " ".into(),
        status_tag(session.status),
        " ".into(),
        muted(&pad(short_model(session.model.as_deref()), MODEL_WIDTH)),
        " ".into(),
        muted(&pad_start(
            &runtime.map_or_else(|| "-".to_string(), format_duration),
            TIME_WIDTH,
        )),
        " ".into(),
        dim(&pad_start(
            &format!("{} ago", format_age(now - session.updated_at)),
            AGE_WIDTH,
        )),
        " ".into(),
        if rest > 8 {
            dim(&truncate(session.last.as_deref().unwrap_or(""), rest))
        } else {
            String::new()
        },
    ]
    .concat()
}

pub fn render_empty(window_ms: f64, hidden_idle: usize) -> Vec<String> {
    vec![
        String::new(),
        dim(&if hidden_idle > 0 {
            format!(
                "  {hidden_idle} idle session{} hidden. Press i to show.",
                if hidden_idle == 1 { "" } else { "s" }
            )
        } else {
            format!(
                "  No live Claude sessions or Codex sessions active in the last {}.",
                format_age(window_ms)
            )
        }),
    ]
}

pub fn render_session_header(session: &Session, now: f64) -> String {
    let runtime = session_runtime(session, now);
    let mut details = vec![session.cwd.clone()];
    if let Some(runtime) = runtime {
        details.push(format!("time {}", format_duration(runtime)));
    }
    details.push(format!(
        "updated {} ago",
        format_age(now - session.updated_at)
    ));
    [
        agent_tag(session.agent),
        " ".into(),
        status_tag(session.status),
        " ".into(),
        short_model(session.model.as_deref()).into(),
        "  ".into(),
        bold(&session.title),
        "  ".into(),
        dim(&details.join(" · ")),
    ]
    .concat()
}

const PREFIX_WIDTH: usize = 16;

/// Collapse runs of three or more newlines into a blank line.
fn collapse_newlines(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut run = 0;
    for char in text.chars() {
        if char == '\n' {
            run += 1;
            continue;
        }
        out.push_str(if run >= 3 { "\n\n" } else { &"\n\n"[..run] });
        run = 0;
        out.push(char);
    }
    out.push_str(if run >= 3 { "\n\n" } else { &"\n\n"[..run] });
    out
}

/// Render log entries into terminal lines that fit `width`. `continued` marks
/// entries appended after existing lines, which only affects the blank line
/// separating user prompts, so appended output renders exactly as in a full
/// re-render.
pub fn render_entries(entries: &[LogEntry], width: i64, continued: bool) -> Vec<String> {
    let body_width = (width - PREFIX_WIDTH as i64).max(10);
    let mut lines = Vec::new();
    for entry in entries {
        let kind = kind_style(entry.kind);
        let text = match entry.title() {
            Some(title) if entry.text.is_empty() => title.to_string(),
            Some(title) => format!("{title} {}", entry.text),
            None => entry.text.clone(),
        };
        let collapsed = collapse_newlines(&text);
        let body = crate::text::js_trim(&collapsed);
        if body.is_empty() {
            continue;
        }
        if entry.kind == EntryKind::User && (continued || !lines.is_empty()) {
            lines.push(String::new());
        }
        let wrapped = wrap(body, body_width);
        let shown = wrapped.len().min(kind.max_lines);
        let clock = entry.time.map_or_else(|| " ".repeat(8), format_clock);
        for (index, line) in wrapped[..shown].iter().enumerate() {
            let prefix = if index == 0 {
                format!("{} {} ", dim(&clock), (kind.paint)(&pad(kind.label, 6)))
            } else {
                " ".repeat(PREFIX_WIDTH)
            };
            lines.push(prefix + &(kind.paint)(line));
        }
        if wrapped.len() > shown {
            lines.push(
                " ".repeat(PREFIX_WIDTH) + &dim(&format!("… +{} lines", wrapped.len() - shown)),
            );
        }
    }
    lines
}
