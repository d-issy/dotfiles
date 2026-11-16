use crate::js;
use crate::model::LogEntry;

/// Length of the escape sequence after an ESC, matching
/// `\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_]`.
fn escape_len(rest: &[char]) -> Option<usize> {
    let count_while = |start: usize, accept: &dyn Fn(char) -> bool| {
        rest[start.min(rest.len())..]
            .iter()
            .take_while(|&&c| accept(c))
            .count()
    };
    match rest.first() {
        Some('[') => {
            let params = count_while(1, &|c| ('0'..='?').contains(&c));
            let end = 1 + params + count_while(1 + params, &|c| (' '..='/').contains(&c));
            if rest.get(end).is_some_and(|c| ('@'..='~').contains(c)) {
                return Some(end + 1);
            }
            return None;
        }
        Some(']') => {
            let end = 1 + count_while(1, &|c| c != '\u{7}' && c != '\u{1b}');
            match (rest.get(end), rest.get(end + 1)) {
                (Some('\u{7}'), _) => return Some(end + 1),
                (Some('\u{1b}'), Some('\\')) => return Some(end + 2),
                _ => {}
            }
        }
        _ => {}
    }
    rest.first()
        .filter(|c| ('@'..='Z').contains(*c) || ('\\'..='_').contains(*c))
        .map(|_| 1)
}

fn strip_escape_sequences(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut index = 0;
    while let Some(&char) = chars.get(index) {
        if char == '\u{1b}'
            && let Some(len) = escape_len(&chars[index + 1..])
        {
            index += 1 + len;
            continue;
        }
        out.push(char);
        index += 1;
    }
    out
}

fn is_control(char: char) -> bool {
    matches!(char, '\0'..='\u{8}' | '\u{b}'..='\u{1f}' | '\u{7f}'..='\u{9f}')
}

pub fn sanitize(text: &str) -> String {
    strip_escape_sequences(text)
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\t', "  ")
        .chars()
        .filter(|&char| !is_control(char))
        .collect()
}

pub fn one_line(text: &str) -> String {
    sanitize(text)
        .split(js::is_whitespace)
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_wide(code: u32) -> bool {
    matches!(
        code,
        0x1100..=0x115f
            | 0x2e80..=0x303e
            | 0x3041..=0x33ff
            | 0x3400..=0x4dbf
            | 0x4e00..=0x9fff
            | 0xa000..=0xa4cf
            | 0xac00..=0xd7a3
            | 0xf900..=0xfaff
            | 0xfe30..=0xfe4f
            | 0xff00..=0xff60
            | 0xffe0..=0xffe6
            | 0x1f300..=0x1f64f
            | 0x1f900..=0x1f9ff
            | 0x20000..=0x3fffd
    )
}

fn is_zero_width(code: u32) -> bool {
    matches!(code, 0x0300..=0x036f | 0x200b..=0x200f | 0xfe00..=0xfe0f | 0x20e3)
}

pub fn char_width(char: char) -> usize {
    let code = u32::from(char);
    if is_zero_width(code) {
        0
    } else if is_wide(code) {
        2
    } else {
        1
    }
}

pub fn width(text: &str) -> usize {
    text.chars().map(char_width).sum()
}

pub fn truncate(text: &str, max: usize) -> String {
    if max == 0 {
        return String::new();
    }
    if width(text) <= max {
        return text.to_string();
    }
    let mut used = 0;
    let mut out: String = text
        .chars()
        .take_while(|&char| {
            used += char_width(char);
            used < max
        })
        .collect();
    out.push('…');
    out
}

pub fn pad(text: &str, size: usize) -> String {
    let cut = truncate(text, size);
    let fill = size.saturating_sub(width(&cut));
    format!("{cut}{}", " ".repeat(fill))
}

pub fn wrap(text: &str, max: usize) -> Vec<String> {
    if max == 0 {
        return Vec::new();
    }
    let mut lines = Vec::new();
    for raw in text.split('\n') {
        let mut line = String::new();
        let mut used = 0;
        for char in raw.chars() {
            let w = char_width(char);
            if used + w > max {
                lines.push(std::mem::take(&mut line));
                used = 0;
            }
            line.push(char);
            used += w;
        }
        lines.push(line);
    }
    lines
}

pub fn last_summary(entries: &[LogEntry]) -> Option<String> {
    let entry = entries.last()?;
    Some(match entry.non_empty_title() {
        Some(title) => one_line(&format!("{title} {}", entry.text)),
        None => one_line(&entry.text),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn measures_wide_characters() {
        assert_eq!(width("abc"), 3);
        assert_eq!(width("日本語"), 6);
    }

    #[test]
    fn truncates_and_wraps_by_display_width() {
        assert_eq!(truncate("日本語テキスト", 7), "日本語…");
        assert_eq!(wrap("日本語abc", 4), ["日本", "語ab", "c"]);
    }

    #[test]
    fn strips_terminal_escapes_and_control_characters() {
        assert_eq!(sanitize("\u{1b}]0;title\u{7}a\u{1b}[2Jb\r\nc\0"), "ab\nc");
    }
}
