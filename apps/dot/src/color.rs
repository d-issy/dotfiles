use std::fmt::Display;

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

    pub fn paint(self, text: impl Display) -> String {
        format!("{}{text}{RESET}", self.code())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_ansi_codes_and_resets_each_value() {
        for (color, code) in [
            (Color::Red, 31),
            (Color::Green, 32),
            (Color::Yellow, 33),
            (Color::Blue, 34),
        ] {
            assert_eq!(color.paint(42), format!("\x1b[0;{code}m42\x1b[0m"));
        }
    }
}
