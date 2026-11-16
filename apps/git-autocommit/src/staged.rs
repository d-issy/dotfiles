use crate::color::Color;
use std::fmt;

/// One `git diff --name-status` line. Renames keep both paths in `path`.
pub struct StagedEntry<'a> {
    status: &'a str,
    path: &'a str,
}

impl<'a> StagedEntry<'a> {
    pub fn parse(line: &'a str) -> Self {
        let (status, path) = line.split_once('\t').unwrap_or((line, ""));
        Self { status, path }
    }

    fn color(&self) -> Option<Color> {
        match self.status {
            "A" => Some(Color::Green),
            "D" => Some(Color::Red),
            "M" => Some(Color::Yellow),
            _ => None,
        }
    }
}

impl fmt::Display for StagedEntry<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.color() {
            Some(color) => write!(f, "  {} {}", color.paint(self.status), self.path),
            None => write!(f, "  {} {}", self.status, self.path),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn staged_lines_are_colored_by_status() {
        let line = |l| StagedEntry::parse(l).to_string();
        assert_eq!(
            line("A\tf.txt"),
            format!("  {} f.txt", Color::Green.paint("A"))
        );
        assert_eq!(
            line("D\tf.txt"),
            format!("  {} f.txt", Color::Red.paint("D"))
        );
        assert_eq!(
            line("M\tf.txt"),
            format!("  {} f.txt", Color::Yellow.paint("M"))
        );
        assert_eq!(line("R100\ta\tb"), "  R100 a\tb");
    }
}
