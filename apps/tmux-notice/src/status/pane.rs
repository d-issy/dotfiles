use super::{FIELD_SEPARATOR, env};
use crate::tmux;

pub struct Style {
    pub inactive: String,
    pub bright: String,
}

impl Style {
    pub fn from_env() -> Self {
        Self {
            inactive: env("TMUX_STATUS_PANE_INACTIVE_STYLE"),
            bright: env("TMUX_STATUS_NOTICE_BRIGHT"),
        }
    }
}

#[derive(Default)]
pub struct Fields {
    icons: String,
    fallback_icon: String,
    notice_title: String,
    pane_title: String,
}

impl Fields {
    pub fn query(target: &str) -> Self {
        let line = tmux::capture(&[
            "display-message",
            "-p",
            "-t",
            target,
            "#{@tmux_notice_icons}\u{1f}#{@pane_notice_icon}\u{1f}#{@pane_notice_title}\u{1f}#{pane_title}",
        ]);
        Self::parse(&line)
    }

    fn parse(line: &str) -> Self {
        let mut it = line.splitn(4, FIELD_SEPARATOR).map(str::to_string);
        Self {
            icons: it.next().unwrap_or_default(),
            fallback_icon: it.next().unwrap_or_default(),
            notice_title: it.next().unwrap_or_default(),
            pane_title: it.next().unwrap_or_default(),
        }
    }
}

/// Mirrors bash `IFS='|' read -a`: one trailing delimiter adds no empty field.
fn split_icons(raw: &str) -> Vec<&str> {
    if raw.is_empty() {
        return Vec::new();
    }
    let mut parts: Vec<&str> = raw.split('|').collect();
    if raw.ends_with('|') {
        parts.pop();
    }
    parts
}

/// n icons cycle over n+1 frames; the extra frame repeats the first icon.
fn icon_at(raw: &str, frame: u64) -> String {
    let parts = split_icons(raw);
    let Some(first) = parts.first() else {
        return String::new();
    };
    let slot = (frame % (parts.len() as u64 + 1)) as usize;
    parts.get(slot).unwrap_or(first).to_string()
}

pub fn render(fields: &Fields, scope: &str, label: &str, frame: u64, style: &Style) -> String {
    let icons = if fields.icons.is_empty() {
        &fields.fallback_icon
    } else {
        &fields.icons
    };
    let pane_title = &fields.pane_title;
    let inactive = scope == "inactive";
    let inactive_style = &style.inactive;

    if icons.is_empty() {
        return if inactive && !label.is_empty() {
            format!("#[{inactive_style}]{label} {pane_title}")
        } else {
            pane_title.clone()
        };
    }

    let title = if fields.notice_title.is_empty() {
        pane_title
    } else {
        &fields.notice_title
    };
    let icon = icon_at(icons, frame);
    if !inactive {
        return format!("{icon} {title}");
    }
    let icon = if icon.chars().any(|c| !c.is_whitespace()) {
        format!("#[fg={}]{icon}", style.bright)
    } else {
        icon
    };
    format!("#[{inactive_style}]{label} {icon}#[{inactive_style}] {title}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn style() -> Style {
        Style {
            inactive: "fg=grey".to_string(),
            bright: "colour3".to_string(),
        }
    }

    fn fields(icons: &str, fallback: &str, title: &str, pane: &str) -> Fields {
        Fields {
            icons: icons.to_string(),
            fallback_icon: fallback.to_string(),
            notice_title: title.to_string(),
            pane_title: pane.to_string(),
        }
    }

    #[test]
    fn icon_animation_cycles_with_extra_first_frame() {
        assert_eq!(icon_at("a|b", 0), "a");
        assert_eq!(icon_at("a|b", 1), "b");
        assert_eq!(icon_at("a|b", 2), "a");
        assert_eq!(icon_at("a|b", 3), "a");
        assert_eq!(icon_at("a|b", 4), "b");
        assert_eq!(icon_at("x", 7), "x");
        assert_eq!(icon_at("", 3), "");
    }

    #[test]
    fn icon_split_matches_bash_read() {
        assert_eq!(split_icons("a|b"), ["a", "b"]);
        assert_eq!(split_icons("a|"), ["a"]);
        assert_eq!(split_icons("a||b"), ["a", "", "b"]);
        assert_eq!(split_icons("|"), [""]);
        assert_eq!(split_icons("• | "), ["• ", " "]);
    }

    #[test]
    fn without_notice() {
        let f = fields("", "", "", "shell");
        assert_eq!(render(&f, "", "", 0, &style()), "shell");
        assert_eq!(render(&f, "active", "2", 0, &style()), "shell");
        assert_eq!(
            render(&f, "inactive", "2", 0, &style()),
            "#[fg=grey]2 shell"
        );
        assert_eq!(render(&f, "inactive", "", 0, &style()), "shell");
    }

    #[test]
    fn with_notice() {
        let f = fields("a|b", "a", "", "shell");
        assert_eq!(render(&f, "active", "", 1, &style()), "b shell");
        let f = fields("a|b", "a", "Title", "shell");
        assert_eq!(
            render(&f, "inactive", "3", 1, &style()),
            "#[fg=grey]3 #[fg=colour3]b#[fg=grey] Title"
        );
        let f = fields("•| ", "•", "T", "shell");
        assert_eq!(
            render(&f, "inactive", "3", 1, &style()),
            "#[fg=grey]3  #[fg=grey] T"
        );
        let f = fields("", "•", "T", "shell");
        assert_eq!(render(&f, "", "", 5, &style()), "• T");
    }

    #[test]
    fn field_parsing_keeps_separators_in_last_field() {
        let f = Fields::parse("a\u{1f}b\u{1f}c\u{1f}d\u{1f}e");
        assert_eq!(f.pane_title, "d\u{1f}e");
    }
}
