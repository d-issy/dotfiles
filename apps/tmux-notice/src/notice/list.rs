use super::config::{Config, Notice};

struct Row {
    name: String,
    title_mode: String,
    pane_title: &'static str,
    color: String,
    strip: String,
    animation: String,
}

impl Row {
    fn new(name: &str, notice: &Notice) -> Self {
        let strip = if notice.title_strip_patterns.is_empty() {
            "-".to_string()
        } else {
            notice
                .title_strip_patterns
                .iter()
                .map(|p| format!("/{p}/"))
                .collect::<Vec<_>>()
                .join(", ")
        };
        let animation = notice
            .icons
            .iter()
            .map(|i| icon_label(i))
            .collect::<Vec<_>>()
            .join(" -> ");
        Self {
            name: tsv_escape(name),
            title_mode: notice.title_mode.to_string(),
            pane_title: if notice.pane_title.enable {
                "set"
            } else {
                "unchanged"
            },
            color: tsv_escape(
                notice
                    .session_notification_indicator_color
                    .as_deref()
                    .unwrap_or("-"),
            ),
            strip: tsv_escape(&strip),
            animation: tsv_escape(&animation),
        }
    }

    fn columns(&self) -> [&str; 6] {
        [
            &self.name,
            &self.title_mode,
            self.pane_title,
            &self.color,
            &self.strip,
            &self.animation,
        ]
    }
}

fn icon_label(icon: &str) -> &str {
    if icon.is_empty() {
        "(empty)"
    } else if icon.chars().all(|c| c == ' ') {
        "(blank)"
    } else {
        icon
    }
}

/// The shell version printed jq `@tsv` output verbatim, so list cells carry
/// tsv escapes (notably doubled backslashes).
fn tsv_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '\\' => out.push_str("\\\\"),
            '\t' => out.push_str("\\t"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            c => out.push(c),
        }
    }
    out
}

fn pad(value: &str, width: usize) -> String {
    format!("{value:<width$}")
}

fn line(cols: [&str; 6], strip_width: usize) -> String {
    format!(
        "{}  {}  {}  {}  {}  {}\n",
        pad(cols[0], 16),
        pad(cols[1], 8),
        pad(cols[2], 10),
        pad(cols[3], 7),
        pad(cols[4], strip_width),
        cols[5]
    )
}

pub fn format(config: &Config) -> String {
    let mut rows: Vec<Row> = config
        .notices
        .iter()
        .map(|(name, notice)| Row::new(name, notice))
        .collect();
    rows.push(Row::new("<fallback>", &config.fallback));

    let strip_width = rows
        .iter()
        .map(|r| r.strip.chars().count())
        .fold(5, usize::max);

    let mut out = String::from("Usage: tmux-notice on <notice>\n\n");
    out.push_str(&line(
        [
            "notice",
            "title",
            "paneTitle",
            "session",
            "strip",
            "animation",
        ],
        strip_width,
    ));
    out.push_str(&line(
        [
            "----------------",
            "--------",
            "----------",
            "-------",
            &"-".repeat(strip_width),
            "---------",
        ],
        strip_width,
    ));
    for row in &rows {
        out.push_str(&line(row.columns(), strip_width));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_output() {
        let config: Config = dot::json::from_str(
            r#"{
              "fallback": {"icons": ["•"], "titleMode": "name"},
              "notices": {
                "done": {"icons": ["✓", " ", ""], "titleMode": "current",
                         "sessionNotificationIndicatorColor": "colour2",
                         "titleStripPatterns": ["^\\s+", "x"],
                         "paneTitle": {"enable": true}}
              }
            }"#,
        )
        .unwrap();
        let expected = "\
Usage: tmux-notice on <notice>

notice            title     paneTitle   session  strip         animation
----------------  --------  ----------  -------  ------------  ---------
done              current   set         colour2  /^\\\\s+/, /x/  ✓ -> (blank) -> (empty)
<fallback>        name      unchanged   -        -             •
";
        assert_eq!(format(&config), expected);
    }

    #[test]
    fn tsv_escaping() {
        assert_eq!(tsv_escape("a\\b\tc"), "a\\\\b\\tc");
    }
}
