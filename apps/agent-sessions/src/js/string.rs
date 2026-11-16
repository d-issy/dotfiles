use std::cmp::Ordering;

pub fn is_whitespace(char: char) -> bool {
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

pub fn trim(text: &str) -> &str {
    text.trim_matches(is_whitespace)
}

pub fn trim_end(text: &str) -> &str {
    text.trim_end_matches(is_whitespace)
}

/// `String.prototype.padStart`, which counts UTF-16 code units.
pub fn pad_start(text: &str, size: usize) -> String {
    let len = text.encode_utf16().count();
    format!("{}{text}", " ".repeat(size.saturating_sub(len)))
}

/// `String.prototype.slice(0, end)`. A surrogate pair cut in half becomes
/// U+FFFD, which is what Node wrote out for the lone surrogate.
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

/// Node's POSIX `path.basename`.
pub fn basename(path: &str) -> &str {
    let trimmed = path.trim_end_matches('/');
    trimmed.rsplit_once('/').map_or(trimmed, |(_, name)| name)
}

const ASCII_COLLATION: &str = "\t\n\u{b}\u{c}\r _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$0123456789";

fn primary_weight(char: char) -> Option<u32> {
    if let Some(index) = ASCII_COLLATION.find(char) {
        return u32::try_from(index).ok();
    }
    if char.is_ascii_alphabetic() {
        return Some(100 + u32::from(char.to_ascii_lowercase()) - u32::from('a'));
    }
    if char.is_ascii_control() {
        return None;
    }
    Some(1000 + u32::from(char))
}

/// Approximates ICU root collation as used by `String.prototype.localeCompare`.
pub fn locale_compare(a: &str, b: &str) -> Ordering {
    let weights = |text: &str| -> Vec<(u32, bool)> {
        text.chars()
            .filter_map(|char| {
                primary_weight(char).map(|weight| (weight, char.is_ascii_uppercase()))
            })
            .collect()
    };
    let (left, right) = (weights(a), weights(b));
    let primary = || {
        left.iter()
            .map(|weight| weight.0)
            .cmp(right.iter().map(|weight| weight.0))
    };
    let tertiary = || {
        left.iter()
            .map(|weight| weight.1)
            .cmp(right.iter().map(|weight| weight.1))
    };
    primary().then_with(tertiary)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_like_locale_compare() {
        assert_eq!(locale_compare("apps", "Dotfiles"), Ordering::Less);
        assert_eq!(locale_compare("a", "A"), Ordering::Less);
        assert_eq!(locale_compare("a-b", "a1"), Ordering::Less);
        assert_eq!(locale_compare("same", "same"), Ordering::Equal);
    }
}
