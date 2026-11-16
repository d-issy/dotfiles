/// `$(...)` drops every trailing newline, retaining other whitespace.
pub fn strip_trailing_newlines(text: &str) -> &str {
    text.trim_end_matches('\n')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_only_trailing_newlines() {
        assert_eq!(strip_trailing_newlines("\n a \n\n"), "\n a ");
        assert_eq!(strip_trailing_newlines("a\r\n"), "a\r");
        assert_eq!(strip_trailing_newlines("\n\n"), "");
        assert_eq!(strip_trailing_newlines(""), "");
    }
}
