//! Version-aware ordering equivalent to GNU `sort -V` and the Cursor/Codex model name filters.

use std::cmp::Ordering;

fn order(byte: Option<u8>) -> i32 {
    match byte {
        None => 0,
        Some(b) if b.is_ascii_digit() => 0,
        Some(b) if b.is_ascii_alphabetic() => i32::from(b),
        Some(b'~') => -1,
        Some(b) => i32::from(b) + 256,
    }
}

fn digit_at(bytes: &[u8], pos: usize) -> bool {
    bytes.get(pos).is_some_and(u8::is_ascii_digit)
}

/// Compares two strings the way `sort -V` does.
pub fn version_cmp(left: &str, right: &str) -> Ordering {
    let (a, b) = (left.as_bytes(), right.as_bytes());
    let (mut i, mut j) = (0, 0);
    while i < a.len() || j < b.len() {
        while (i < a.len() && !a[i].is_ascii_digit()) || (j < b.len() && !b[j].is_ascii_digit()) {
            let left_order = order(a.get(i).copied());
            let right_order = order(b.get(j).copied());
            if left_order != right_order {
                return left_order.cmp(&right_order);
            }
            i += 1;
            j += 1;
        }
        while a.get(i) == Some(&b'0') {
            i += 1;
        }
        while b.get(j) == Some(&b'0') {
            j += 1;
        }
        let mut first_diff = 0i32;
        while digit_at(a, i) && digit_at(b, j) {
            if first_diff == 0 {
                first_diff = i32::from(a[i]) - i32::from(b[j]);
            }
            i += 1;
            j += 1;
        }
        if digit_at(a, i) {
            return Ordering::Greater;
        }
        if digit_at(b, j) {
            return Ordering::Less;
        }
        if first_diff != 0 {
            return first_diff.cmp(&0);
        }
    }
    Ordering::Equal
}

/// Returns the highest entry by version order, like `sort -V | tail -n 1`.
pub fn latest<'a>(items: impl IntoIterator<Item = &'a str>) -> Option<&'a str> {
    items
        .into_iter()
        .max_by(|a, b| version_cmp(a, b).then_with(|| a.cmp(b)))
}

/// Matches `[0-9]+([.][0-9]+)*`.
pub fn is_dotted_number(text: &str) -> bool {
    !text.is_empty()
        && text
            .split('.')
            .all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn orders_numeric_segments_numerically() {
        assert_eq!(version_cmp("gpt-5.2-sol", "gpt-5.10-sol"), Ordering::Less);
        assert_eq!(version_cmp("a9", "a10"), Ordering::Less);
        assert_eq!(version_cmp("a1", "a1"), Ordering::Equal);
        assert_eq!(version_cmp("composer-2", "composer-1.5"), Ordering::Greater);
    }

    #[test]
    fn picks_latest() {
        let items = ["composer-1", "composer-2.5", "composer-2.10", "composer-2"];
        assert_eq!(latest(items), Some("composer-2.10"));
        assert_eq!(latest([]), None);
    }

    #[test]
    fn dotted_numbers() {
        assert!(is_dotted_number("5"));
        assert!(is_dotted_number("5.1.20"));
        assert!(!is_dotted_number(""));
        assert!(!is_dotted_number("5."));
        assert!(!is_dotted_number(".5"));
        assert!(!is_dotted_number("5a"));
    }
}
