use std::cmp::Ordering;

use chrono::{Local, TimeZone, Timelike};

use crate::json::js_num;
use crate::types::LogEntry;

/// JavaScript `\s` / `String.prototype.trim` whitespace.
pub fn is_js_space(char: char) -> bool {
    matches!(
        char,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

pub fn js_trim(text: &str) -> &str {
    text.trim_matches(is_js_space)
}

pub fn js_trim_end(text: &str) -> &str {
    text.trim_end_matches(is_js_space)
}

/// Length of an escape sequence following ESC, matching
/// `\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_]`.
fn escape_len(rest: &[char]) -> Option<usize> {
    let at = |index: usize| rest.get(index).copied();
    if at(0) == Some('[') {
        let mut index = 1;
        while at(index).is_some_and(|c| ('0'..='?').contains(&c)) {
            index += 1;
        }
        while at(index).is_some_and(|c| (' '..='/').contains(&c)) {
            index += 1;
        }
        if at(index).is_some_and(|c| ('@'..='~').contains(&c)) {
            return Some(index + 1);
        }
    } else if at(0) == Some(']') {
        let mut index = 1;
        while at(index).is_some_and(|c| c != '\u{7}' && c != '\u{1b}') {
            index += 1;
        }
        if at(index) == Some('\u{7}') {
            return Some(index + 1);
        }
        if at(index) == Some('\u{1b}') && at(index + 1) == Some('\\') {
            return Some(index + 2);
        }
    }
    match at(0) {
        Some(c) if ('@'..='Z').contains(&c) || ('\\'..='_').contains(&c) => Some(1),
        _ => None,
    }
}

fn is_control(char: char) -> bool {
    matches!(char, '\0'..='\u{8}' | '\u{b}'..='\u{1f}' | '\u{7f}'..='\u{9f}')
}

/// Strip terminal escape sequences and control characters from untrusted log text.
pub fn sanitize(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut stripped = Vec::with_capacity(chars.len());
    let mut index = 0;
    while index < chars.len() {
        if chars[index] == '\u{1b}'
            && let Some(len) = escape_len(&chars[index + 1..])
        {
            index += 1 + len;
            continue;
        }
        stripped.push(chars[index]);
        index += 1;
    }
    let mut out = String::with_capacity(stripped.len());
    let mut index = 0;
    while index < stripped.len() {
        match stripped[index] {
            '\r' => {
                if stripped.get(index + 1) == Some(&'\n') {
                    index += 1;
                }
                out.push('\n');
            }
            '\t' => out.push_str("  "),
            c if is_control(c) => {}
            c => out.push(c),
        }
        index += 1;
    }
    out
}

pub fn one_line(text: &str) -> String {
    let mut out = String::new();
    let mut in_space = false;
    for char in sanitize(text).chars() {
        if is_js_space(char) {
            if !in_space {
                out.push(' ');
            }
            in_space = true;
        } else {
            out.push(char);
            in_space = false;
        }
    }
    js_trim(&out).to_string()
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
    let code = char as u32;
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

/// Truncate plain text to a display width, appending an ellipsis when cut.
pub fn truncate(text: &str, max: i64) -> String {
    if max <= 0 {
        return String::new();
    }
    if width(text) as i64 <= max {
        return text.to_string();
    }
    let mut out = String::new();
    let mut used = 0;
    for char in text.chars() {
        let w = char_width(char) as i64;
        if used + w > max - 1 {
            break;
        }
        out.push(char);
        used += w;
    }
    out.push('…');
    out
}

pub fn pad(text: &str, size: i64) -> String {
    let cut = truncate(text, size);
    let fill = (size - width(&cut) as i64).max(0) as usize;
    format!("{cut}{}", " ".repeat(fill))
}

/// `String.prototype.padStart` with spaces.
pub fn pad_start(text: &str, size: usize) -> String {
    let len = text.encode_utf16().count();
    format!("{}{text}", " ".repeat(size.saturating_sub(len)))
}

/// Wrap plain text into lines that fit a display width.
pub fn wrap(text: &str, max: i64) -> Vec<String> {
    if max <= 0 {
        return Vec::new();
    }
    let mut lines = Vec::new();
    for raw in text.split('\n') {
        let mut line = String::new();
        let mut used = 0;
        for char in raw.chars() {
            let w = char_width(char) as i64;
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

pub fn format_age(ms: f64) -> String {
    let seconds = (ms / 1000.0).floor().max(0.0);
    if seconds < 60.0 {
        return format!("{}s", js_num(seconds));
    }
    let minutes = (seconds / 60.0).floor();
    if minutes < 60.0 {
        return format!("{}m", js_num(minutes));
    }
    let hours = (minutes / 60.0).floor();
    if hours < 48.0 {
        return format!("{}h", js_num(hours));
    }
    format!("{}d", js_num((hours / 24.0).floor()))
}

pub fn format_clock(time: f64) -> String {
    let millis = time.trunc();
    if !millis.is_finite() || millis.abs() > 8.64e15 {
        return "NaN:NaN:NaN".into();
    }
    match Local.timestamp_millis_opt(millis as i64).earliest() {
        Some(date) => format!(
            "{:02}:{:02}:{:02}",
            date.hour(),
            date.minute(),
            date.second()
        ),
        None => "NaN:NaN:NaN".into(),
    }
}

pub fn last_summary(entries: &[LogEntry]) -> Option<String> {
    let entry = entries.last()?;
    Some(match entry.title() {
        Some(title) => one_line(&format!("{title} {}", entry.text)),
        None => one_line(&entry.text),
    })
}

/// Parse durations like `30m`, `2h`, or `1d`; bare numbers are minutes.
pub fn parse_duration(value: &str) -> Option<f64> {
    let value = js_trim(value);
    let split = value
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(value.len());
    let (number, unit) = value.split_at(split);
    if number.is_empty() {
        return None;
    }
    let scale = match unit {
        "s" => 1000.0,
        "" | "m" => 60_000.0,
        "h" => 3_600_000.0,
        "d" => 86_400_000.0,
        _ => return None,
    };
    Some(number.parse::<f64>().ok()? * scale)
}

fn two(value: f64) -> String {
    pad_start_zero(&js_num(value))
}

fn pad_start_zero(text: &str) -> String {
    if text.len() < 2 {
        format!("0{text}")
    } else {
        text.to_string()
    }
}

/// Compact duration such as `45s`, `12m05s`, or `1h05m`.
pub fn format_duration(ms: f64) -> String {
    let seconds = (ms / 1000.0).floor().max(0.0);
    if seconds < 60.0 {
        return format!("{}s", js_num(seconds));
    }
    let minutes = (seconds / 60.0).floor();
    if minutes < 60.0 {
        return format!("{}m{}s", js_num(minutes), two(seconds % 60.0));
    }
    let hours = (minutes / 60.0).floor();
    if hours < 48.0 {
        return format!("{}h{}m", js_num(hours), two(minutes % 60.0));
    }
    format!("{}d{}h", js_num((hours / 24.0).floor()), two(hours % 24.0))
}

/// `String.prototype.slice(0, end)` counted in UTF-16 code units; a split
/// surrogate pair becomes U+FFFD as it would when written out as UTF-8.
pub fn slice_utf16(text: &str, end: usize) -> String {
    let mut out = String::new();
    let mut used = 0;
    for char in text.chars() {
        let len = char.len_utf16();
        if used + len > end {
            if used < end {
                out.push('\u{fffd}');
            }
            break;
        }
        out.push(char);
        used += len;
    }
    out
}

/// Root-collation order of ASCII punctuation and symbols (ICU/CLDR), which
/// all sort before digits and letters.
const ASCII_ORDER: &str = "\t\n\u{b}\u{c}\r _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$0123456789";

fn primary(char: char) -> Option<u32> {
    if let Some(index) = ASCII_ORDER.find(char) {
        return Some(index as u32);
    }
    if char.is_ascii_alphabetic() {
        return Some(100 + u32::from(char.to_ascii_lowercase() as u8 - b'a'));
    }
    if char.is_ascii_control() {
        return None;
    }
    Some(1000 + char as u32)
}

/// Approximates `String.prototype.localeCompare` (ICU root collation):
/// punctuation < digits < letters, case-insensitive first, then lowercase
/// before uppercase.
pub fn locale_compare(a: &str, b: &str) -> Ordering {
    let keys = |text: &str| -> Vec<(u32, bool)> {
        text.chars()
            .filter_map(|char| primary(char).map(|key| (key, char.is_ascii_uppercase())))
            .collect()
    };
    let (left, right) = (keys(a), keys(b));
    let primary_order = left
        .iter()
        .map(|key| key.0)
        .cmp(right.iter().map(|key| key.0));
    primary_order.then_with(|| {
        left.iter()
            .map(|key| key.1)
            .cmp(right.iter().map(|key| key.1))
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

    #[test]
    fn parses_durations() {
        assert_eq!(parse_duration("30"), Some(1_800_000.0));
        assert_eq!(parse_duration("2h"), Some(7_200_000.0));
        assert_eq!(parse_duration("1d"), Some(86_400_000.0));
        assert_eq!(parse_duration("soon"), None);
    }

    #[test]
    fn formats_durations() {
        for (ms, text) in [
            (45_000.0, "45s"),
            (725_000.0, "12m05s"),
            (3_900_000.0, "1h05m"),
            (180_000_000.0, "2d02h"),
        ] {
            assert_eq!(format_duration(ms), text, "formats {ms} ms");
        }
    }

    #[test]
    fn compares_like_locale_compare() {
        assert_eq!(locale_compare("apps", "Dotfiles"), Ordering::Less);
        assert_eq!(locale_compare("a", "A"), Ordering::Less);
        assert_eq!(locale_compare("a-b", "a1"), Ordering::Less);
        assert_eq!(locale_compare("same", "same"), Ordering::Equal);
    }
}
