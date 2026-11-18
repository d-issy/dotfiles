mod keys;
mod log_view;
mod terminal;

use std::io::{self, Read};
use std::ops::ControlFlow;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};

use dot::signal::{Signal, Signals};

use crate::format::format_age;
use crate::model::{Session, SessionStatus};
use crate::render::{
    bold, dim, render_column_header, render_empty, render_project_row, render_session_row,
};
use crate::sessions::{
    Discovery, Row, SessionRow, filter_sessions, now_ms, session_indices, to_rows,
};
use crate::text::truncate;
use keys::{Key, KeyDecoder};
use log_view::{LogView, body_height};
use terminal::{Size, Terminal};

const REFRESH_INTERVAL: Duration = Duration::from_secs(1);
const LOG_POLL_INTERVAL: Duration = Duration::from_millis(300);

enum Event {
    Input(Vec<u8>),
    Resize,
    Terminate,
}

fn spawn_event_sources() -> io::Result<Receiver<Event>> {
    let (sender, receiver) = mpsc::channel();
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
    let signals = Signals::new([
        Signal::Interrupt,
        Signal::Terminate,
        Signal::Hangup,
        Signal::Resize,
    ])?;
    thread::spawn(move || {
        for signal in signals {
            let event = if signal == Signal::Resize {
                Event::Resize
            } else {
                Event::Terminate
            };
            if sender.send(event).is_err() {
                break;
            }
        }
    });
    Ok(receiver)
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Timer {
    EscapeFlush,
    Refresh,
    LogPoll,
}

struct Schedule {
    refresh: Instant,
    log_poll: Instant,
}

impl Schedule {
    fn start(now: Instant) -> Self {
        Self {
            refresh: now + REFRESH_INTERVAL,
            log_poll: now + LOG_POLL_INTERVAL,
        }
    }

    fn deadlines(&self, escape: Option<Instant>) -> impl Iterator<Item = (Instant, Timer)> {
        escape
            .map(|at| (at, Timer::EscapeFlush))
            .into_iter()
            .chain([
                (self.refresh, Timer::Refresh),
                (self.log_poll, Timer::LogPoll),
            ])
    }

    fn next_deadline(&self, escape: Option<Instant>) -> Instant {
        self.deadlines(escape)
            .map(|(at, _)| at)
            .min()
            .unwrap_or(self.refresh)
    }

    fn take_due(&mut self, escape: Option<Instant>, now: Instant) -> Option<Timer> {
        let (_, timer) = self.deadlines(escape).filter(|(at, _)| *at <= now).min()?;
        match timer {
            Timer::Refresh => self.refresh = now + REFRESH_INTERVAL,
            Timer::LogPoll => self.log_poll = now + LOG_POLL_INTERVAL,
            Timer::EscapeFlush => {}
        }
        Some(timer)
    }
}

pub fn run(window_ms: f64, show_idle: bool) -> io::Result<()> {
    let terminal = Terminal::enter()?;
    let result = App::new(window_ms, show_idle).run();
    drop(terminal);
    result
}

struct App {
    window_ms: f64,
    show_idle: bool,
    discovery: Discovery,
    rows: Vec<Row>,
    session_indices: Vec<usize>,
    /// Index into `session_indices`.
    selected: usize,
    hidden_idle: usize,
    log: Option<LogView>,
    keys: KeyDecoder,
}

impl App {
    fn new(window_ms: f64, show_idle: bool) -> Self {
        Self {
            window_ms,
            show_idle,
            discovery: Discovery::from_env(),
            rows: Vec::new(),
            session_indices: Vec::new(),
            selected: 0,
            hidden_idle: 0,
            log: None,
            keys: KeyDecoder::default(),
        }
    }

    fn run(mut self) -> io::Result<()> {
        let events = spawn_event_sources()?;
        self.refresh();
        let mut schedule = Schedule::start(Instant::now());
        loop {
            let deadline = schedule.next_deadline(self.keys.flush_at());
            let timeout = deadline.saturating_duration_since(Instant::now());
            let flow = match events.recv_timeout(timeout) {
                Ok(Event::Input(bytes)) => {
                    let keys = self.keys.feed(&bytes);
                    self.handle_keys(keys)
                }
                Ok(Event::Resize) => {
                    self.draw();
                    ControlFlow::Continue(())
                }
                Ok(Event::Terminate) => ControlFlow::Break(()),
                Err(RecvTimeoutError::Timeout) => ControlFlow::Continue(()),
                Err(RecvTimeoutError::Disconnected) => {
                    thread::sleep(timeout);
                    ControlFlow::Continue(())
                }
            };
            if flow.is_break() || self.fire_due_timers(&mut schedule).is_break() {
                return Ok(());
            }
        }
    }

    fn fire_due_timers(&mut self, schedule: &mut Schedule) -> ControlFlow<()> {
        while let Some(timer) = schedule.take_due(self.keys.flush_at(), Instant::now()) {
            match timer {
                Timer::EscapeFlush => {
                    let keys = self.keys.flush();
                    self.handle_keys(keys)?;
                }
                Timer::Refresh => self.refresh(),
                Timer::LogPoll => self.poll_log(),
            }
        }
        ControlFlow::Continue(())
    }

    fn handle_keys(&mut self, keys: Vec<Key>) -> ControlFlow<()> {
        for key in keys {
            self.on_key(key)?;
        }
        self.keys.arm_timeout();
        ControlFlow::Continue(())
    }

    fn session_rows(&self) -> impl Iterator<Item = &SessionRow> {
        self.session_indices
            .iter()
            .filter_map(|&index| self.rows[index].as_session())
    }

    fn selected_session(&self) -> Option<&Session> {
        let index = *self.session_indices.get(self.selected)?;
        self.rows[index].as_session().map(|row| &row.session)
    }

    fn refresh(&mut self) {
        let current = self.selected_session().map(|session| session.key.clone());
        if let Some(log) = &mut self.log {
            // Read the open transcript before discovery prunes sessions that just exited.
            self.discovery.refresh_open_log(&mut log.session);
        }
        let discovered = self.discovery.discover(self.window_ms, now_ms());
        let visible = filter_sessions(discovered.clone(), self.show_idle);
        self.hidden_idle = discovered.len() - visible.len();
        self.rows = to_rows(&visible);
        self.session_indices = session_indices(&self.rows);
        let kept = self
            .session_rows()
            .position(|row| Some(&row.session.key) == current.as_ref());
        self.selected = kept
            .unwrap_or(self.selected)
            .min(self.session_indices.len().saturating_sub(1));
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
        let Some(log) = self.selected_session().and_then(LogView::open) else {
            return;
        };
        self.log = Some(log);
        self.poll_log();
        self.draw();
    }

    fn poll_log(&mut self) {
        let size = Size::current();
        if self.log.as_mut().is_some_and(|log| log.poll(size)) {
            self.draw();
        }
    }

    fn on_key(&mut self, key: Key) -> ControlFlow<()> {
        if key == Key::CtrlC {
            return ControlFlow::Break(());
        }
        if self.log.is_some() {
            self.on_log_key(key);
        } else {
            self.on_list_key(key)?;
        }
        self.draw();
        ControlFlow::Continue(())
    }

    fn on_list_key(&mut self, key: Key) -> ControlFlow<()> {
        let last = self.session_indices.len().saturating_sub(1);
        match key {
            Key::Char('q') | Key::Escape => return ControlFlow::Break(()),
            Key::Char('j') | Key::Down => self.selected = (self.selected + 1).min(last),
            Key::Char('k') | Key::Up => self.selected = self.selected.saturating_sub(1),
            Key::Char('g') => self.selected = 0,
            Key::Char('G') => self.selected = last,
            Key::Char('r') => self.refresh(),
            Key::Char('i') => {
                self.show_idle = !self.show_idle;
                self.refresh();
            }
            Key::Enter | Key::Char('l') | Key::Right => self.open_log(),
            _ => {}
        }
        ControlFlow::Continue(())
    }

    fn on_log_key(&mut self, key: Key) {
        let height = Size::current().height;
        let page = (body_height(height) / 2).max(1).cast_signed();
        let Some(log) = &mut self.log else {
            return;
        };
        match key {
            Key::Char('q' | 'h') | Key::Escape | Key::Left | Key::Backspace => self.log = None,
            Key::Char('k') | Key::Up => log.scroll_by(1, height),
            Key::Char('j') | Key::Down => log.scroll_by(-1, height),
            Key::CtrlU | Key::PageUp => log.scroll_by(page, height),
            Key::CtrlD | Key::PageDown => log.scroll_by(-page, height),
            Key::Char('g') => log.scroll_by(isize::MAX, height),
            Key::Char('G') => log.follow(),
            _ => {}
        }
    }

    fn draw(&mut self) {
        let size = Size::current();
        let now = now_ms();
        let lines = match &mut self.log {
            Some(log) => log.render(size, now),
            None => self.list_lines(size, now),
        };
        let screen: Vec<String> = lines
            .iter()
            .take(size.height)
            .map(|line| format!("{line}\u{1b}[0m\u{1b}[K"))
            .collect();
        terminal::write(&format!("\u{1b}[H{}\u{1b}[J", screen.join("\r\n")));
    }

    fn list_header(&self, width: usize) -> String {
        let count = |status: SessionStatus| {
            self.session_rows()
                .filter(|row| row.session.status == status)
                .count()
        };
        let hidden = if self.hidden_idle > 0 {
            format!(" · {} idle hidden", self.hidden_idle)
        } else {
            String::new()
        };
        bold(&truncate(
            &format!(
                "Agent sessions · {} shown · {} running · {} awaiting input{hidden}",
                self.session_indices.len(),
                count(SessionStatus::Running),
                count(SessionStatus::Waiting) + count(SessionStatus::Idle),
            ),
            width,
        ))
    }

    fn list_footer(&self, width: usize) -> String {
        dim(&truncate(
            &format!(
                "↑↓/jk select · enter log · i idle: {} · r refresh · q quit · window {}",
                if self.show_idle { "shown" } else { "hidden" },
                format_age(self.window_ms)
            ),
            width,
        ))
    }

    fn visible_rows(&self, size: Size, body: usize, now: f64) -> Vec<String> {
        if self.rows.is_empty() {
            return render_empty(self.window_ms, self.hidden_idle);
        }
        let selected = self.session_indices.get(self.selected).copied();
        let cursor = selected.unwrap_or(0);
        let start = cursor
            .saturating_sub(body / 2)
            .min(self.rows.len().saturating_sub(body));
        let end = (start + body).min(self.rows.len());
        (start..end)
            .map(|index| match &self.rows[index] {
                Row::Project { cwd, sessions } => render_project_row(cwd, *sessions, size.width),
                Row::Session(row) => {
                    render_session_row(row, Some(index) == selected, size.width, now)
                }
            })
            .collect()
    }

    fn list_lines(&self, size: Size, now: f64) -> Vec<String> {
        let body = size.height.saturating_sub(3);
        let rows = self.visible_rows(size, body, now);
        let filler = body.saturating_sub(rows.len());
        let mut lines = vec![
            self.list_header(size.width),
            render_column_header(size.width),
        ];
        lines.extend(rows);
        lines.extend(std::iter::repeat_n(String::new(), filler));
        lines.push(self.list_footer(size.width));
        lines
    }
}
