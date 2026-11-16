use std::io::{self, Write};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use rustix::termios::{
    ControlModes, InputModes, LocalModes, OptionalActions, OutputModes, SpecialCodeIndex, Termios,
    tcgetattr, tcgetwinsize, tcsetattr,
};

/// Alternate screen, hidden cursor, and no autowrap so long lines are clipped.
const ENTER: &str = "\u{1b}[?1049h\u{1b}[?25l\u{1b}[?7l";
const LEAVE: &str = "\u{1b}[?7h\u{1b}[?25h\u{1b}[?1049l";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Size {
    pub width: usize,
    pub height: usize,
}

impl Size {
    pub fn current() -> Self {
        let (columns, rows) =
            tcgetwinsize(io::stdout()).map_or((0, 0), |size| (size.ws_col, size.ws_row));
        Self {
            width: if columns == 0 { 100 } else { columns.into() },
            height: if rows == 0 { 30 } else { rows.into() },
        }
    }
}

/// Same flags as libuv's `UV_TTY_MODE_RAW`, which Node's `setRawMode` uses.
fn raw_mode(original: &Termios) -> Termios {
    let mut raw = original.clone();
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
    raw
}

pub fn write(text: &str) {
    let mut out = io::stdout().lock();
    let _ = out.write_all(text.as_bytes());
    let _ = out.flush();
}

fn restore(original: &Termios, restored: &AtomicBool) {
    if restored.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = tcsetattr(io::stdin(), OptionalActions::Drain, original);
    write(LEAVE);
}

/// The full-screen raw-mode session; dropping it restores the terminal, and
/// so does a panic.
pub struct Terminal {
    original: Termios,
    restored: Arc<AtomicBool>,
}

impl Terminal {
    pub fn enter() -> io::Result<Self> {
        let original = tcgetattr(io::stdin())?;
        let restored = Arc::new(AtomicBool::new(false));
        write(ENTER);
        let terminal = Self {
            original: original.clone(),
            restored: Arc::clone(&restored),
        };
        tcsetattr(io::stdin(), OptionalActions::Drain, &raw_mode(&original))?;
        let default_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            restore(&original, &restored);
            default_hook(info);
            std::process::exit(1);
        }));
        Ok(terminal)
    }
}

impl Drop for Terminal {
    fn drop(&mut self) {
        restore(&self.original, &self.restored);
    }
}
