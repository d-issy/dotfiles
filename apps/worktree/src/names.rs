#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Names {
    pub branch: String,
    pub window: String,
}

impl Names {
    /// Split `branch<TAB>window` at the first tab, as the shell version did
    /// when it passed both names through one `printf '%s\t%s'` line.
    pub fn from_tab_pair(text: &str) -> Self {
        let (branch, window) = crate::shell::bash_split_first_tab(text);
        Self {
            branch: branch.to_string(),
            window: window.to_string(),
        }
    }
}

/// sed `s#[/\\]+#-#g; s#[^A-Za-z0-9._-]+#-#g; s#-+#-#g; s#^-+##; s#-+$##`
pub fn sanitize_path_component(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        let ch = if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
            ch
        } else {
            '-'
        };
        if !(ch == '-' && out.ends_with('-')) {
            out.push(ch);
        }
    }
    out.trim_matches('-').to_string()
}

pub fn short_window_from_branch(branch: &str) -> String {
    let last = branch.rsplit_once('/').map_or(branch, |(_, last)| last);
    let mut window = sanitize_path_component(last);
    if window.chars().count() > 24 {
        window = window.chars().take(24).collect();
        if window.ends_with('-') {
            window.pop();
        }
    }
    if window.is_empty() {
        "worktree".into()
    } else {
        window
    }
}

pub fn pr_number_suffix(name: &str) -> Option<&str> {
    let (_, digits) = name.rsplit_once(".pr-")?;
    (!digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit())).then_some(digits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_like_sed() {
        assert_eq!(sanitize_path_component("feat/a b\\c"), "feat-a-b-c");
        assert_eq!(sanitize_path_component("--x--y--"), "x-y");
        assert_eq!(sanitize_path_component("ünï"), "n");
    }

    #[test]
    fn short_windows() {
        assert_eq!(short_window_from_branch("feature/add-thing"), "add-thing");
        assert_eq!(short_window_from_branch("x/"), "worktree");
        assert_eq!(
            short_window_from_branch("abcdefghijklmnopqrstuvw-xyz"),
            "abcdefghijklmnopqrstuvw"
        );
    }

    #[test]
    fn pr_suffix() {
        assert_eq!(pr_number_suffix("repo.pr-12"), Some("12"));
        assert_eq!(pr_number_suffix("repo.pr-1x"), None);
        assert_eq!(pr_number_suffix("repo.pr-"), None);
    }

    #[test]
    fn tab_pair() {
        let names = Names::from_tab_pair("a\tb\tc");
        assert_eq!(
            (names.branch.as_str(), names.window.as_str()),
            ("a", "b\tc")
        );
    }
}
