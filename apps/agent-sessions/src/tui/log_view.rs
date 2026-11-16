use crate::files::JsonlTail;
use crate::model::{LogEntry, Session};
use crate::render::{GREEN, YELLOW, dim, render_entries, render_session_header};
use crate::sessions::parse_record;
use crate::text::truncate;

use super::terminal::Size;

const MAX_ENTRIES: usize = 3000;
const INITIAL_LOG_BYTES: u64 = 2 * 1024 * 1024;

pub fn body_height(height: usize) -> usize {
    height.saturating_sub(3).max(1)
}

pub struct LogView {
    pub session: Session,
    tail: JsonlTail,
    entries: Vec<LogEntry>,
    lines: Vec<String>,
    /// Width the current `lines` were wrapped for; `None` once entries change.
    layout_width: Option<usize>,
    /// Lines scrolled up from the bottom; 0 follows new output.
    scroll: usize,
}

impl LogView {
    pub fn open(session: &Session) -> Option<Self> {
        let path = session.log_path.as_ref()?;
        Some(Self {
            session: session.clone(),
            tail: JsonlTail::new(path, INITIAL_LOG_BYTES),
            entries: Vec::new(),
            lines: Vec::new(),
            layout_width: None,
            scroll: 0,
        })
    }

    pub fn poll(&mut self, size: Size) -> bool {
        let records = self.tail.poll();
        let added: Vec<LogEntry> = records
            .iter()
            .flat_map(|record| parse_record(&self.session, record))
            .collect();
        if added.is_empty() {
            return false;
        }
        self.entries.extend(added.iter().cloned());
        let excess = self.entries.len().saturating_sub(MAX_ENTRIES);
        self.entries.drain(..excess);
        // A paused viewport stays anchored by shifting it by exactly the
        // appended lines; evicted entries only remove lines above it.
        let appended = if self.scroll > 0 {
            render_entries(&added, size.width, !self.lines.is_empty()).len()
        } else {
            0
        };
        self.layout_width = None;
        self.layout(size);
        if self.scroll > 0 {
            self.scroll += appended;
            self.clamp_scroll(size.height);
        }
        true
    }

    fn layout(&mut self, size: Size) {
        if self.layout_width == Some(size.width) {
            return;
        }
        self.lines = render_entries(&self.entries, size.width, false);
        self.layout_width = Some(size.width);
        self.clamp_scroll(size.height);
    }

    fn clamp_scroll(&mut self, height: usize) {
        let max = self.lines.len().saturating_sub(body_height(height));
        self.scroll = self.scroll.min(max);
    }

    pub fn scroll_by(&mut self, delta: isize, height: usize) {
        self.scroll = self.scroll.saturating_add_signed(delta);
        self.clamp_scroll(height);
    }

    pub fn follow(&mut self) {
        self.scroll = 0;
    }

    pub fn render(&mut self, size: Size, now: f64) -> Vec<String> {
        self.layout(size);
        // The height may change without a reflow, so re-clamp every frame.
        self.clamp_scroll(size.height);
        let body = body_height(size.height);
        let end = self.lines.len().saturating_sub(self.scroll);
        let visible = &self.lines[end.saturating_sub(body)..end];
        let mode = if self.scroll == 0 {
            GREEN.paint("FOLLOW")
        } else {
            YELLOW.paint(&format!("PAUSED +{}", self.scroll))
        };
        let hints = truncate(
            "· jk scroll · ^u/^d page · g top · G follow · q/esc back",
            size.width.saturating_sub(12),
        );
        let mut lines = vec![
            render_session_header(&self.session, now),
            dim(&"─".repeat(size.width)),
        ];
        lines.extend(visible.iter().cloned());
        lines.resize(2 + body.max(visible.len()), String::new());
        lines.push(format!("{mode} {}", dim(&hints)));
        lines
    }
}
