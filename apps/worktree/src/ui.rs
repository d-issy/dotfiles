#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Color {
    Red,
    Green,
    Yellow,
    Blue,
}

const RESET: &str = "\x1b[0m";

impl Color {
    const fn code(self) -> &'static str {
        match self {
            Self::Red => "\x1b[0;31m",
            Self::Green => "\x1b[0;32m",
            Self::Yellow => "\x1b[0;33m",
            Self::Blue => "\x1b[0;34m",
        }
    }

    pub fn paint(self, text: &str) -> String {
        format!("{}{text}{RESET}", self.code())
    }
}

pub fn warning_line(message: &str) -> String {
    format!("{} {message}", Color::Yellow.paint("Warning:"))
}

pub fn warn(message: &str) {
    eprintln!("{}", warning_line(message));
}
