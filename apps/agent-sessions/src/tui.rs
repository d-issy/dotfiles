use std::io::{self, Read, Write};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use rustix::termios::{
    ControlModes, InputModes, LocalModes, OptionalActions, OutputModes, SpecialCodeIndex, Termios,
    tcgetattr, tcgetwinsize, tcsetattr,
};
use signal_hook::consts::{SIGHUP, SIGINT, SIGTERM, SIGWINCH};
use signal_hook::iterator::Signals;

use crate::files::JsonlTail;
use crate::render::{
    GREEN, YELLOW, bold, color, dim, render_column_header, render_empty, render_entries,
    render_project_row, render_session_header, render_session_row,
};
use crate::sessions::{
    Discovery, Row, filter_sessions, now_ms, parse_record, session_row, session_rows, to_rows,
};
use crate::text::{format_age, truncate};
use crate::types::{LogEntry, Session, SessionStatus};

const MAX_ENTRIES: usize = 3000;
const INITIAL_LOG_BYTES: u64 = 2 * 1024 * 1024;
/// How long to wait for the rest of a split escape sequence.
const ESCAPE_TIMEOUT: Duration = Duration::from_millis(30);
const REFRESH_INTERVAL: Duration = Duration::from_millis(2000);
const LOG_INTERVAL: Duration = Duration::from_millis(300);

struct LogView {
    session: Session,
    tail: JsonlTail,
    entries: Vec<LogEntry>,
    lines: Vec<String>,
    lines_width: i64,
    dirty: bool,
    /// Lines scrolled up from the bottom; 0 follows new output.
    scroll: i64,
}

/// Length of a complete key at the start of `chars`, matching
/// `\x1b\[[0-9;]*[~A-Za-z]|\x1bO[A-Za-z]|[\s\S]`.
fn key_len(chars: &[char]) -> usize {
    if chars.first() == Some(&'\u{1b}') {
        match chars.get(1) {
            Some('[') => {
                let mut index = 2;
                while chars
                    .get(index)
                    .is_some_and(|c| c.is_ascii_digit() || *c == ';')
                {
                    index += 1;
                }
                if chars
                    .get(index)
                    .is_some_and(|c| *c == '~' || c.is_ascii_alphabetic())
                {
                    return index + 1;
                }
            }
            Some('O') if chars.get(2).is_some_and(char::is_ascii_alphabetic) => return 3,
            _ => {}
        }
    }
    1
}

/// Start of a trailing escape prefix matching `\x1b(?:\[[0-9;]*|O)?$`.
fn incomplete_escape(chars: &[char]) -> Option<usize> {
    let start = chars.iter().rposition(|c| *c == '\u{1b}')?;
    let rest = &chars[start + 1..];
    let complete = match rest.split_first() {
        None => true,
        Some(('O', tail)) => tail.is_empty(),
        Some(('[', tail)) => tail.iter().all(|c| c.is_ascii_digit() || *c == ';'),
        Some(_) => false,
    };
    complete.then_some(start)
}

/// Split raw input into keys. A trailing escape prefix is returned as `pending`
/// because terminals may deliver one sequence across several chunks.
pub fn split_keys(input: &str, flush: bool) -> (Vec<String>, String) {
    let chars: Vec<char> = input.chars().collect();
    let incomplete = if flush {
        None
    } else {
        incomplete_escape(&chars)
    };
    let end = incomplete.unwrap_or(chars.len());
    let mut keys = Vec::new();
    let mut index = 0;
    while index < end {
        let len = key_len(&chars[index..end]);
        keys.push(chars[index..index + len].iter().collect());
        index += len;
    }
    (keys, chars[end..].iter().collect())
}

static ORIGINAL_MODE: Mutex<Option<Termios>> = Mutex::new(None);
static CLOSED: AtomicBool = AtomicBool::new(false);

fn enter_raw_mode() -> io::Result<()> {
    let original = tcgetattr(io::stdin())?;
    let mut raw = original.clone();
    // Same flags as libuv's UV_TTY_MODE_RAW.
    raw.input_modes -= InputModes::BRKINT
        | InputModes::ICRNL
        | InputModes::INPCK
        | InputModes::ISTRIP
        | InputModes::IXON;
    raw.output_modes |= OutputModes::ONLCR;
    raw.control_modes |= ControlModes::CS8;
    raw.local_modes -=
        LocalModes::ECHO | LocalModes::ICANON | LocalModes::IEXTEN | LocalModes::ISIG;
    raw.special_codes[SpecialCodeIndex::VMIN] = 1;
    raw.special_codes[SpecialCodeIndex::VTIME] = 0;
    if let Ok(mut saved) = ORIGINAL_MODE.lock() {
        *saved = Some(original);
    }
    tcsetattr(io::stdin(), OptionalActions::Drain, &raw)?;
    Ok(())
}

fn write_out(text: &str) {
    let mut out = io::stdout().lock();
    let _ = out.write_all(text.as_bytes());
    let _ = out.flush();
}

fn restore() {
    if CLOSED.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Ok(saved) = ORIGINAL_MODE.lock()
        && let Some(original) = saved.as_ref()
    {
        let _ = tcsetattr(io::stdin(), OptionalActions::Drain, original);
    }
    write_out("\u{1b}[?7h\u{1b}[?25h\u{1b}[?1049l");
}

fn stop() -> ! {
    restore();
    std::process::exit(0);
}

fn terminal_size() -> (i64, i64) {
    let (cols, rows) = tcgetwinsize(io::stdout()).map_or((0, 0), |size| (size.ws_col, size.ws_row));
    (
        if cols == 0 { 100 } else { i64::from(cols) },
        if rows == 0 { 30 } else { i64::from(rows) },
    )
}

fn body_height(height: i64) -> i64 {
    (height - 3).max(1)
}

fn clamp_scroll(log: &mut LogView, height: i64) {
    let max = (log.lines.len() as i64 - body_height(height)).max(0);
    log.scroll = log.scroll.min(max);
}

fn layout_log(log: &mut LogView, width: i64, height: i64) {
    if !log.dirty && log.lines_width == width {
        return;
    }
    log.lines = render_entries(&log.entries, width, false);
    log.lines_width = width;
    log.dirty = false;
    // Reflow can shrink the log; never scroll past its top.
    clamp_scroll(log, height);
}

/// `Array.prototype.slice(start, end)` bounds.
fn js_slice<T>(items: &[T], start: i64, end: i64) -> &[T] {
    let len = items.len() as i64;
    let resolve = |index: i64| {
        if index < 0 {
            (len + index).max(0)
        } else {
            index.min(len)
        }
    };
    let (start, end) = (resolve(start), resolve(end));
    if end <= start {
        &[]
    } else {
        &items[start as usize..end as usize]
    }
}

enum Event {
    Input(Vec<u8>),
    Signal(i32),
}

pub struct Tui {
    window_ms: f64,
    show_idle: bool,
    discovery: Discovery,
    rows: Vec<Row>,
    /// Indices of selectable rows; `selected` indexes into this list.
    sessions: Vec<usize>,
    selected: usize,
    hidden_idle: usize,
    log: Option<LogView>,
    pending_input: String,
    escape_deadline: Option<Instant>,
}

impl Tui {
    pub fn new(window_ms: f64, show_idle: bool) -> Self {
        Self {
            window_ms,
            show_idle,
            discovery: Discovery::new(),
            rows: Vec::new(),
            sessions: Vec::new(),
            selected: 0,
            hidden_idle: 0,
            log: None,
            pending_input: String::new(),
            escape_deadline: None,
        }
    }

    pub fn start(mut self) -> ! {
        // Alternate screen, hidden cursor, no autowrap so long lines are clipped.
        write_out("\u{1b}[?1049h\u{1b}[?25l\u{1b}[?7l");
        let default_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            restore();
            default_hook(info);
            std::process::exit(1);
        }));
        if let Err(error) = enter_raw_mode() {
            panic!("{error}");
        }
        let (sender, events) = mpsc::channel();
        let input = sender.clone();
        thread::spawn(move || {
            let mut stdin = io::stdin().lock();
            let mut buffer = vec![0; 65536];
            while let Ok(read) = stdin.read(&mut buffer) {
                if read == 0 || input.send(Event::Input(buffer[..read].to_vec())).is_err() {
                    break;
                }
            }
        });
        let mut signals = match Signals::new([SIGINT, SIGTERM, SIGHUP, SIGWINCH]) {
            Ok(signals) => signals,
            Err(error) => panic!("{error}"),
        };
        thread::spawn(move || {
            for signal in signals.forever() {
                if sender.send(Event::Signal(signal)).is_err() {
                    break;
                }
            }
        });
        self.refresh();
        let mut next_refresh = Instant::now() + REFRESH_INTERVAL;
        let mut next_poll = Instant::now() + LOG_INTERVAL;
        loop {
            let deadline = self
                .escape_deadline
                .map_or(next_refresh.min(next_poll), |escape| {
                    escape.min(next_refresh).min(next_poll)
                });
            match events.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                Ok(Event::Input(bytes)) => {
                    let input =
                        format!("{}{}", self.pending_input, String::from_utf8_lossy(&bytes));
                    self.on_input(&input, false);
                }
                Ok(Event::Signal(SIGWINCH)) => self.draw(),
                Ok(Event::Signal(_)) => stop(),
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    thread::sleep(deadline.saturating_duration_since(Instant::now()));
                }
            }
            // Fire due timers in deadline order.
            loop {
                let now = Instant::now();
                let escape = self.escape_deadline.filter(|at| *at <= now);
                let due = [escape, Some(next_refresh), Some(next_poll)]
                    .into_iter()
                    .enumerate()
                    .filter_map(|(index, at)| at.filter(|at| *at <= now).map(|at| (at, index)))
                    .min();
                match due {
                    None => break,
                    Some((_, 0)) => {
                        let pending = self.pending_input.clone();
                        self.on_input(&pending, true);
                    }
                    Some((_, 1)) => {
                        next_refresh = now + REFRESH_INTERVAL;
                        self.refresh();
                    }
                    Some(_) => {
                        next_poll = now + LOG_INTERVAL;
                        self.poll_log();
                    }
                }
            }
        }
    }

    fn on_input(&mut self, input: &str, flush: bool) {
        self.escape_deadline = None;
        let (keys, pending) = split_keys(input, flush);
        self.pending_input = pending;
        for key in keys {
            self.on_key(&key);
        }
        // A lone ESC is the Esc key unless the rest of a sequence follows soon.
        if !self.pending_input.is_empty() {
            self.escape_deadline = Some(Instant::now() + ESCAPE_TIMEOUT);
        }
    }

    fn selected_session(&self) -> Option<&Session> {
        let index = *self.sessions.get(self.selected)?;
        session_row(&self.rows[index]).map(|row| row.session)
    }

    fn refresh(&mut self) {
        let current = self.selected_session().map(|session| session.key.clone());
        let discovered = self.discovery.discover(self.window_ms, now_ms());
        let visible = filter_sessions(discovered.clone(), self.show_idle);
        self.hidden_idle = discovered.len() - visible.len();
        self.rows = to_rows(&visible);
        self.sessions = session_rows(&self.rows);
        let index = self.sessions.iter().position(|&row| {
            session_row(&self.rows[row])
                .is_some_and(|row| Some(&row.session.key) == current.as_ref())
        });
        let wanted = index.map_or(self.selected as i64, |index| index as i64);
        self.selected = wanted.min(self.sessions.len() as i64 - 1).max(0) as usize;
        if let Some(log) = &mut self.log
            && let Some(latest) = discovered
                .into_iter()
                .find(|session| session.key == log.session.key)
        {
            log.session = latest;
        }
        self.draw();
    }

    fn open_log(&mut self) {
        let Some(session) = self.selected_session() else {
            return;
        };
        if session.log_path.is_empty() {
            return;
        }
        self.log = Some(LogView {
            session: session.clone(),
            tail: JsonlTail::new(&session.log_path, INITIAL_LOG_BYTES),
            entries: Vec::new(),
            lines: Vec::new(),
            lines_width: 0,
            dirty: true,
            scroll: 0,
        });
        self.poll_log();
        self.draw();
    }

    fn poll_log(&mut self) {
        let (width, height) = terminal_size();
        let Some(log) = &mut self.log else {
            return;
        };
        let records = log.tail.poll();
        if records.is_empty() {
            return;
        }
        let added: Vec<LogEntry> = records
            .iter()
            .flat_map(|record| parse_record(&log.session, record))
            .collect();
        if added.is_empty() {
            return;
        }
        log.entries.extend(added.iter().cloned());
        if log.entries.len() > MAX_ENTRIES {
            let excess = log.entries.len() - MAX_ENTRIES;
            log.entries.drain(..excess);
        }
        // Keep a paused viewport anchored: shift it by exactly the appended lines.
        // Evicted entries only remove lines above the viewport.
        let appended = if log.scroll > 0 {
            render_entries(&added, width, !log.lines.is_empty()).len() as i64
        } else {
            0
        };
        log.dirty = true;
        layout_log(log, width, height);
        if log.scroll > 0 {
            log.scroll += appended;
            clamp_scroll(log, height);
        }
        self.draw();
    }

    fn scroll_by(&mut self, delta: i64) {
        let (_, height) = terminal_size();
        let Some(log) = &mut self.log else {
            return;
        };
        log.scroll = log.scroll.saturating_add(delta).max(0);
        clamp_scroll(log, height);
    }

    fn on_key(&mut self, key: &str) {
        if key == "\u{3}" {
            stop();
        }
        if self.log.is_some() {
            self.on_log_key(key);
        } else {
            self.on_list_key(key);
        }
        self.draw();
    }

    fn on_list_key(&mut self, key: &str) {
        match key {
            "q" | "\u{1b}" => stop(),
            "j" | "\u{1b}[B" => {
                self.selected = (self.selected as i64 + 1)
                    .min(self.sessions.len() as i64 - 1)
                    .max(0) as usize;
            }
            "k" | "\u{1b}[A" => self.selected = self.selected.saturating_sub(1),
            "g" => self.selected = 0,
            "G" => self.selected = self.sessions.len().saturating_sub(1),
            "r" => self.refresh(),
            "i" => {
                self.show_idle = !self.show_idle;
                self.refresh();
            }
            "\r" | "l" | "\u{1b}[C" => self.open_log(),
            _ => {}
        }
    }

    fn on_log_key(&mut self, key: &str) {
        let (_, height) = terminal_size();
        let page = (body_height(height) / 2).max(1);
        match key {
            "q" | "h" | "\u{1b}" | "\u{1b}[D" | "\u{7f}" => self.log = None,
            "k" | "\u{1b}[A" => self.scroll_by(1),
            "j" | "\u{1b}[B" => self.scroll_by(-1),
            "\u{15}" | "\u{1b}[5~" => self.scroll_by(page),
            "\u{4}" | "\u{1b}[6~" => self.scroll_by(-page),
            "g" => self.scroll_by(9_007_199_254_740_991),
            "G" => {
                if let Some(log) = &mut self.log {
                    log.scroll = 0;
                }
            }
            _ => {}
        }
    }

    fn draw(&mut self) {
        if CLOSED.load(Ordering::SeqCst) {
            return;
        }
        let (width, height) = terminal_size();
        let now = now_ms();
        let lines = match self.log.take() {
            Some(mut log) => {
                let lines = Self::draw_log(&mut log, width, height, now);
                self.log = Some(log);
                lines
            }
            None => self.draw_list(width, height, now),
        };
        let screen: Vec<String> = lines
            .iter()
            .take(height.max(0) as usize)
            .map(|line| format!("{line}\u{1b}[0m\u{1b}[K"))
            .collect();
        write_out(&format!("\u{1b}[H{}\u{1b}[J", screen.join("\r\n")));
    }

    fn draw_list(&self, width: i64, height: i64, now: f64) -> Vec<String> {
        let count = |status: SessionStatus| {
            self.sessions
                .iter()
                .filter(|&&row| {
                    session_row(&self.rows[row]).is_some_and(|row| row.session.status == status)
                })
                .count()
        };
        let hidden = if self.hidden_idle > 0 {
            format!(" · {} idle hidden", self.hidden_idle)
        } else {
            String::new()
        };
        let header = bold(&truncate(
            &format!(
                "Agent sessions · {} shown · {} running · {} awaiting input{hidden}",
                self.sessions.len(),
                count(SessionStatus::Running),
                count(SessionStatus::Waiting) + count(SessionStatus::Idle),
            ),
            width,
        ));
        let body = height - 3;
        let selected_row = self.sessions.get(self.selected).copied();
        let cursor = selected_row.map_or(0, |row| row as i64);
        let start = (cursor - body.div_euclid(2))
            .min(self.rows.len() as i64 - body)
            .max(0);
        let rows: Vec<String> = if self.rows.is_empty() {
            render_empty(self.window_ms, self.hidden_idle)
        } else {
            let slice = js_slice(&self.rows, start, start + body);
            slice
                .iter()
                .enumerate()
                .map(|(offset, row)| {
                    let index = start as usize + offset;
                    match row {
                        Row::Project { cwd, sessions } => render_project_row(cwd, *sessions, width),
                        Row::Session { .. } => match session_row(row) {
                            Some(session) => render_session_row(
                                &session,
                                Some(index) == selected_row,
                                width,
                                now,
                            ),
                            None => String::new(),
                        },
                    }
                })
                .collect()
        };
        let footer = dim(&truncate(
            &format!(
                "↑↓/jk select · enter log · i idle: {} · r refresh · q quit · window {}",
                if self.show_idle { "shown" } else { "hidden" },
                format_age(self.window_ms)
            ),
            width,
        ));
        let filler = (body - rows.len() as i64).max(0) as usize;
        let mut lines = vec![header, render_column_header(width)];
        lines.extend(rows);
        lines.extend(std::iter::repeat_n(String::new(), filler));
        lines.push(footer);
        lines
    }

    fn draw_log(log: &mut LogView, width: i64, height: i64, now: f64) -> Vec<String> {
        layout_log(log, width, height);
        // The height may have changed without a reflow, so re-clamp every frame.
        clamp_scroll(log, height);
        let body = (height - 3).max(1);
        let end = (log.lines.len() as i64 - log.scroll).max(0);
        let visible = js_slice(&log.lines, (end - body).max(0), end);
        let mode = if log.scroll == 0 {
            color(GREEN, "FOLLOW")
        } else {
            color(YELLOW, &format!("PAUSED +{}", log.scroll))
        };
        let footer = format!(
            "{mode} {}",
            dim(&truncate(
                "· jk scroll · ^u/^d page · g top · G follow · q/esc back",
                width - 12,
            ))
        );
        let filler = (body - visible.len() as i64).max(0) as usize;
        let mut lines = vec![
            render_session_header(&log.session, now),
            dim(&"─".repeat(width.max(0) as usize)),
        ];
        lines.extend(visible.iter().cloned());
        lines.extend(std::iter::repeat_n(String::new(), filler));
        lines.push(footer);
        lines
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn split(input: &str, flush: bool) -> (Vec<String>, String) {
        split_keys(input, flush)
    }

    #[test]
    fn splits_batched_keys_and_escape_sequences() {
        assert_eq!(
            split("kk\u{1b}[A\u{1b}[5~\r", false),
            (
                vec![
                    "k".to_string(),
                    "k".into(),
                    "\u{1b}[A".into(),
                    "\u{1b}[5~".into(),
                    "\r".into()
                ],
                String::new()
            )
        );
    }

    #[test]
    fn holds_back_an_escape_sequence_split_across_chunks() {
        let first = split("j\u{1b}", false);
        assert_eq!(first, (vec!["j".to_string()], "\u{1b}".to_string()));
        assert_eq!(
            split(&format!("{}[A", first.1), false),
            (vec!["\u{1b}[A".to_string()], String::new())
        );
        assert_eq!(split("\u{1b}[5", false), (vec![], "\u{1b}[5".to_string()));
    }

    #[test]
    fn treats_a_flushed_lone_escape_as_the_esc_key() {
        assert_eq!(
            split("\u{1b}", true),
            (vec!["\u{1b}".to_string()], String::new())
        );
    }
}
