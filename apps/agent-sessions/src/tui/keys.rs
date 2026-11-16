use std::time::{Duration, Instant};

/// How long to wait for the rest of an escape sequence split across reads.
const ESCAPE_TIMEOUT: Duration = Duration::from_millis(30);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Key {
    Char(char),
    Enter,
    Escape,
    Backspace,
    CtrlC,
    CtrlD,
    CtrlU,
    Up,
    Down,
    Left,
    Right,
    PageUp,
    PageDown,
    Other,
}

impl From<&str> for Key {
    fn from(raw: &str) -> Self {
        match raw {
            "\r" => Self::Enter,
            "\u{1b}" => Self::Escape,
            "\u{7f}" => Self::Backspace,
            "\u{3}" => Self::CtrlC,
            "\u{4}" => Self::CtrlD,
            "\u{15}" => Self::CtrlU,
            "\u{1b}[A" => Self::Up,
            "\u{1b}[B" => Self::Down,
            "\u{1b}[C" => Self::Right,
            "\u{1b}[D" => Self::Left,
            "\u{1b}[5~" => Self::PageUp,
            "\u{1b}[6~" => Self::PageDown,
            _ => {
                let mut chars = raw.chars();
                match (chars.next(), chars.next()) {
                    (Some(char), None) => Self::Char(char),
                    _ => Self::Other,
                }
            }
        }
    }
}

/// Length of the key at the start of `chars`, matching
/// `\x1b\[[0-9;]*[~A-Za-z]|\x1bO[A-Za-z]|[\s\S]`.
fn key_len(chars: &[char]) -> usize {
    match chars {
        ['\u{1b}', '[', rest @ ..] => {
            let params = rest
                .iter()
                .take_while(|c| c.is_ascii_digit() || **c == ';')
                .count();
            match rest.get(params) {
                Some(c) if *c == '~' || c.is_ascii_alphabetic() => params + 3,
                _ => 1,
            }
        }
        ['\u{1b}', 'O', c, ..] if c.is_ascii_alphabetic() => 3,
        _ => 1,
    }
}

/// Start of a trailing, possibly incomplete escape sequence matching
/// `\x1b(?:\[[0-9;]*|O)?$`.
fn incomplete_escape_start(chars: &[char]) -> Option<usize> {
    let start = chars.iter().rposition(|c| *c == '\u{1b}')?;
    let incomplete = match &chars[start + 1..] {
        [] | ['O'] => true,
        ['[', params @ ..] => params.iter().all(|c| c.is_ascii_digit() || *c == ';'),
        _ => false,
    };
    incomplete.then_some(start)
}

#[derive(Debug, PartialEq, Eq)]
pub struct SplitKeys {
    pub keys: Vec<String>,
    pub pending: String,
}

/// Split raw input into keys, holding back a trailing escape prefix as
/// `pending` because a terminal may deliver one sequence across several reads.
pub fn split_keys(input: &str, flush: bool) -> SplitKeys {
    let chars: Vec<char> = input.chars().collect();
    let end = if flush {
        chars.len()
    } else {
        incomplete_escape_start(&chars).unwrap_or(chars.len())
    };
    let mut keys = Vec::new();
    let mut index = 0;
    while index < end {
        let len = key_len(&chars[index..end]);
        keys.push(chars[index..index + len].iter().collect());
        index += len;
    }
    SplitKeys {
        keys,
        pending: chars[end..].iter().collect(),
    }
}

/// Turns raw input chunks into keys. A lone ESC counts as the Esc key once no
/// continuation arrives within the escape timeout.
#[derive(Default)]
pub struct KeyDecoder {
    pending: String,
    flush_at: Option<Instant>,
}

impl KeyDecoder {
    pub fn feed(&mut self, bytes: &[u8]) -> Vec<Key> {
        let input = format!("{}{}", self.pending, String::from_utf8_lossy(bytes));
        self.decode(&input, false)
    }

    pub fn flush(&mut self) -> Vec<Key> {
        let input = std::mem::take(&mut self.pending);
        self.decode(&input, true)
    }

    fn decode(&mut self, input: &str, flush: bool) -> Vec<Key> {
        self.flush_at = None;
        let SplitKeys { keys, pending } = split_keys(input, flush);
        self.pending = pending;
        keys.iter().map(|key| Key::from(key.as_str())).collect()
    }

    /// Start the escape timeout once the decoded keys have been handled.
    pub fn arm_timeout(&mut self) {
        if !self.pending.is_empty() {
            self.flush_at = Some(Instant::now() + ESCAPE_TIMEOUT);
        }
    }

    pub fn flush_at(&self) -> Option<Instant> {
        self.flush_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn split(input: &str, flush: bool) -> SplitKeys {
        split_keys(input, flush)
    }

    fn keys(keys: &[&str], pending: &str) -> SplitKeys {
        SplitKeys {
            keys: keys.iter().map(ToString::to_string).collect(),
            pending: pending.to_string(),
        }
    }

    #[test]
    fn splits_batched_keys_and_escape_sequences() {
        assert_eq!(
            split("kk\u{1b}[A\u{1b}[5~\r", false),
            keys(&["k", "k", "\u{1b}[A", "\u{1b}[5~", "\r"], "")
        );
    }

    #[test]
    fn holds_back_an_escape_sequence_split_across_chunks() {
        let first = split("j\u{1b}", false);
        assert_eq!(first, keys(&["j"], "\u{1b}"));
        assert_eq!(
            split(&format!("{}[A", first.pending), false),
            keys(&["\u{1b}[A"], "")
        );
        assert_eq!(split("\u{1b}[5", false), keys(&[], "\u{1b}[5"));
    }

    #[test]
    fn treats_a_flushed_lone_escape_as_the_esc_key() {
        assert_eq!(split("\u{1b}", true), keys(&["\u{1b}"], ""));
    }
}
