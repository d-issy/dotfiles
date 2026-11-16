use std::fmt::Display;

#[derive(Clone, Copy)]
pub enum Color {
    Red,
    Green,
    Yellow,
    Blue,
}

const RESET: &str = "\x1b[0m";

impl Color {
    fn code(self) -> &'static str {
        match self {
            Self::Red => "\x1b[0;31m",
            Self::Green => "\x1b[0;32m",
            Self::Yellow => "\x1b[0;33m",
            Self::Blue => "\x1b[0;34m",
        }
    }

    pub fn paint(self, text: impl Display) -> String {
        format!("{}{text}{RESET}", self.code())
    }
}
