use crate::format::{format_age, format_clock, format_duration, format_turn_time};
use crate::js;
use crate::model::{Agent, EntryKind, LogEntry, Session, SessionStatus};
use crate::sessions::{Row, SessionRow, home_dir};
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
const MODEL_HEADER: &str = "MODEL";
const MAX_MODEL_WIDTH: usize = 14;
const EFFORT_WIDTH: usize = "minimal".len();
const TIME_WIDTH: usize = 6;
const SESSION_HEADER: &str = "PROJECT / SESSION";
const BASE_LIST_WIDTH: usize = 2 + AGENT_WIDTH + STATUS_WIDTH + TIME_WIDTH + 4;
const EFFORT_COLUMN_WIDTH: usize = 1 + EFFORT_WIDTH;

#[derive(Clone, Copy)]
pub struct ListLayout {
    width: usize,
    model_width: usize,
    effort_width: usize,
}

impl ListLayout {
    pub fn new(width: usize, rows: &[Row]) -> Self {
        let widest_model = rows
            .iter()
            .filter_map(Row::as_session)
            .map(|row| display_width(short_model(row.session.model.as_deref())))
            .max()
            .unwrap_or(0);
        let model_and_effort = width.saturating_sub(BASE_LIST_WIDTH + SESSION_HEADER.len());
        let effort_width = if model_and_effort >= MODEL_HEADER.len() + EFFORT_COLUMN_WIDTH {
            EFFORT_COLUMN_WIDTH
        } else {
            0
        };
        let max_model_width =
            (model_and_effort - effort_width).clamp(MODEL_HEADER.len(), MAX_MODEL_WIDTH);
        Self {
            width,
            model_width: widest_model.clamp(MODEL_HEADER.len(), max_model_width),
            effort_width,
        }
    }

    fn fixed_width(self) -> usize {
        BASE_LIST_WIDTH + self.model_width + self.effort_width
    }

    fn tree_width(self) -> usize {
        let available = self.width.saturating_sub(self.fixed_width());
        (self.width * 30 / 100)
            .clamp(SESSION_HEADER.len(), 40)
            .min(available)
    }

    fn last_width(self) -> Option<usize> {
        let fixed = self.fixed_width() + self.tree_width() + 1;
        self.width.checked_sub(fixed).filter(|rest| *rest >= 8)
    }

    fn effort_column(self, label: &str) -> String {
        if self.effort_width == 0 {
            String::new()
        } else {
            format!(" {}", pad(label, EFFORT_WIDTH))
        }
    }
}

fn home_relative(path: &str) -> String {
    let home = home_dir();
    let home = home.to_string_lossy();
    match path.strip_prefix(home.as_ref()) {
        Some(rest) if rest.is_empty() || rest.starts_with('/') => format!("~{rest}"),
        _ => path.to_string(),
    }
}

pub fn render_column_header(layout: ListLayout) -> String {
    dim(&[
        "  ",
        &pad(SESSION_HEADER, layout.tree_width()),
        " ",
        &pad("AGENT", AGENT_WIDTH),
        " ",
        &pad("STATUS", STATUS_WIDTH),
        " ",
        &pad(MODEL_HEADER, layout.model_width),
        &layout.effort_column("EFFORT"),
        " ",
        &js::pad_start("TIME", TIME_WIDTH),
        if layout.last_width().is_some() {
            " LAST"
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

pub fn render_session_row(
    row: &SessionRow,
    selected: bool,
    layout: ListLayout,
    now: f64,
) -> String {
    let session = &row.session;
    let is_child = row.depth > 0;
    let muted = |text: &str| -> String {
        if session.status == SessionStatus::Ended {
            dim(text)
        } else {
            text.to_string()
        }
    };
    let guide = truncate(&row.tree, layout.tree_width());
    let title = pad(
        &session.title,
        layout.tree_width().saturating_sub(display_width(&guide)),
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
        muted(&pad(
            short_model(session.model.as_deref()),
            layout.model_width,
        )),
        muted(&layout.effort_column(session.thinking.as_deref().unwrap_or("-"))),
        " ".into(),
        muted(&js::pad_start(&turn_time, TIME_WIDTH)),
        layout.last_width().map_or_else(String::new, |rest| {
            format!(
                " {}",
                dim(&truncate(session.last.as_deref().unwrap_or(""), rest))
            )
        }),
    ]
    .concat()
}

pub fn render_empty(window_ms: f64, hidden_inactive: usize) -> Vec<String> {
    let message = if hidden_inactive > 0 {
        let plural = if hidden_inactive == 1 { "" } else { "s" };
        format!("  {hidden_inactive} inactive session{plural} hidden. Press i to show.")
    } else {
        format!(
            "  No live Claude sessions or Codex/pi sessions active in the last {}.",
            format_age(window_ms)
        )
    };
    vec![String::new(), dim(&message)]
}

pub fn render_session_header(session: &Session, now: f64, width: usize) -> String {
    let effort = format!("effort {}", session.thinking.as_deref().unwrap_or("-"));
    let prefix_width = AGENT_WIDTH + STATUS_WIDTH + 2;
    let metadata_width = prefix_width + display_width(" · ") + display_width(&effort);
    if width <= metadata_width {
        return dim(&truncate(&effort, width));
    }
    let model_name = short_model(session.model.as_deref());
    let available = width - metadata_width;
    let title_width = display_width(&session.title)
        .min(8)
        .min(available.saturating_sub(2 + display_width(model_name).min(4)));
    let reserved_title_width = if title_width == 0 { 0 } else { 2 + title_width };
    let model = truncate(model_name, available - reserved_title_width);
    let mut header = format!(
        "{} {} {model}{}",
        agent_tag(session.agent),
        status_tag(session.status),
        dim(&format!(" · {effort}")),
    );
    let mut remaining = width - metadata_width - display_width(&model);
    let title = truncate(&session.title, remaining.saturating_sub(2));
    if !title.is_empty() {
        header.push_str("  ");
        header.push_str(&bold(&title));
        remaining -= 2 + display_width(&title);
    }
    let detail_width = remaining.saturating_sub(2);
    if detail_width == 0 {
        return header;
    }
    let turn_time = session
        .turn_elapsed(now)
        .map(|elapsed| format!("turn time {}", format_duration(elapsed)));
    let mut details = session.cwd.clone();
    if let Some(turn_time) = turn_time {
        details.push_str(" · ");
        details.push_str(&turn_time);
    }
    header.push_str("  ");
    header.push_str(&dim(&truncate(&details, detail_width)));
    header
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

    fn model_row(model: &str) -> Row {
        Row::Session(Box::new(SessionRow {
            session: Session {
                key: "claude:test".into(),
                agent: Agent::Claude,
                id: "test".into(),
                title: "Test".into(),
                cwd: "/tmp".into(),
                status: SessionStatus::Running,
                updated_at: 0.0,
                started_at: None,
                turn: Default::default(),
                log_path: None,
                parent_key: None,
                model: Some(model.into()),
                thinking: Some("high".into()),
                last: None,
            },
            depth: 0,
            tree: "└─ ".into(),
        }))
    }

    #[test]
    fn sizes_model_to_the_displayed_names_and_aligns_effort() {
        let row = model_row("claude-opus-5-5");
        let layout = ListLayout::new(80, std::slice::from_ref(&row));
        assert_eq!(layout.model_width, "opus-5-5".len());
        let header = render_column_header(layout);
        let line = render_session_row(row.as_session().unwrap(), false, layout, 0.0);
        assert!(line.contains("opus-5-5 high"));
        let header = crate::text::sanitize(&header);
        let line = crate::text::sanitize(&line);
        assert_eq!(
            display_width(header.split_once("EFFORT").unwrap().0),
            display_width(line.split_once("high").unwrap().0),
        );
    }

    #[test]
    fn fits_effort_and_last_activity_in_an_eighty_column_terminal() {
        let rows = [model_row("long-model-name-for-this-test")];
        let wide = ListLayout::new(80, &rows);
        let header = render_column_header(wide);
        assert!(header.contains("EFFORT"));
        assert!(header.contains("LAST"));
        assert_eq!(wide.effort_column("minimal"), " minimal");
        assert_eq!(wide.model_width, MAX_MODEL_WIDTH);
    }

    #[test]
    fn shortens_model_before_hiding_effort_at_a_fixed_width() {
        let rows = [
            model_row("claude-opus"),
            model_row("long-model-name-for-this-test"),
        ];
        assert!(render_column_header(ListLayout::new(60, &rows[..1])).contains("EFFORT"));
        let layout = ListLayout::new(60, &rows);
        let line = render_session_row(rows[1].as_session().unwrap(), false, layout, 0.0);
        assert!(line.contains("long-mode… high"));
        assert!(render_column_header(layout).contains("EFFORT"));
        assert_eq!(display_width(&crate::text::sanitize(&line)), 60);
        assert!(!render_column_header(ListLayout::new(54, &rows)).contains("EFFORT"));
    }

    #[test]
    fn keeps_effort_visible_in_narrow_log_headers() {
        let row = model_row("long-model-name-for-this-test");
        let session = &row.as_session().unwrap().session;
        for width in [12, 40, 80] {
            let line = crate::text::sanitize(&render_session_header(session, 0.0, width));
            assert!(line.contains("effort high"));
            assert!(display_width(&line) <= width);
            assert_eq!(line.contains("long-model-name-for-this-test"), width == 80);
        }
        let narrow = crate::text::sanitize(&render_session_header(session, 0.0, 40));
        assert!(narrow.contains("long… · effort high  Test"));
    }

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
