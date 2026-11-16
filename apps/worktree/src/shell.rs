//! Bash and coreutils semantics that the output format depends on.

use std::io;

/// `$(...)` drops every trailing newline.
pub fn strip_trailing_newlines(text: &str) -> &str {
    text.trim_end_matches('\n')
}

/// An `io::Error` the way coreutils prints it, without Rust's "(os error N)".
pub fn os_error_text(err: &io::Error) -> String {
    let text = err.to_string();
    match text.split_once(" (os error ") {
        Some((message, _)) => message.to_string(),
        None => text,
    }
}

/// `IFS=$'\t' read -r a b ...`: tabs are IFS whitespace, so runs collapse and
/// leading/trailing tabs are dropped; the last field keeps the rest.
pub fn bash_read_tab_fields<const N: usize>(line: &str) -> [String; N] {
    let mut rest = line.trim_start_matches('\t');
    std::array::from_fn(|index| {
        if index + 1 == N {
            let last = rest.trim_end_matches('\t').to_string();
            rest = "";
            return last;
        }
        match rest.split_once('\t') {
            Some((field, tail)) => {
                rest = tail.trim_start_matches('\t');
                field.to_string()
            }
            None => std::mem::take(&mut rest).to_string(),
        }
    })
}

/// `${text%%$'\t'*}` and `${text#*$'\t'}`: without a tab both are the whole text.
pub fn bash_split_first_tab(text: &str) -> (&str, &str) {
    text.split_once('\t').unwrap_or((text, text))
}

pub fn basename(path: &str) -> &str {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() {
        return if path.is_empty() { "" } else { "/" };
    }
    trimmed.rsplit_once('/').map_or(trimmed, |(_, name)| name)
}

pub fn dirname(path: &str) -> &str {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() {
        return if path.is_empty() { "." } else { "/" };
    }
    match trimmed.rsplit_once('/') {
        None => ".",
        Some((parent, _)) => match parent.trim_end_matches('/') {
            "" => "/",
            parent => parent,
        },
    }
}

/// Text as it would arrive through a pipe: one newline-terminated line per row.
pub fn pipe_lines<S: AsRef<str>>(rows: &[S]) -> String {
    rows.iter().fold(String::new(), |mut text, row| {
        text.push_str(row.as_ref());
        text.push('\n');
        text
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tab_fields_follow_bash_read() {
        assert_eq!(
            bash_read_tab_fields::<4>("a\tb\tc\td"),
            ["a", "b", "c", "d"]
        );
        assert_eq!(bash_read_tab_fields::<3>("a\t\tc"), ["a", "c", ""]);
        assert_eq!(bash_read_tab_fields::<2>("a\tb\tc\td"), ["a", "b\tc\td"]);
        assert_eq!(bash_read_tab_fields::<2>("\ta\t"), ["a", ""]);
    }

    #[test]
    fn path_parts_match_coreutils() {
        assert_eq!(basename("/a/b"), "b");
        assert_eq!(basename("/a/b/"), "b");
        assert_eq!(dirname("/a/b"), "/a");
        assert_eq!(dirname("/a"), "/");
        assert_eq!(dirname("a"), ".");
    }

    #[test]
    fn first_tab_split() {
        assert_eq!(bash_split_first_tab("a\tb\tc"), ("a", "b\tc"));
        assert_eq!(bash_split_first_tab("ab"), ("ab", "ab"));
    }
}
