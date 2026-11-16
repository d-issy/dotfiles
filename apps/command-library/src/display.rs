use crate::config::Entry;
use crate::library::Item;
use dot::regex::Regex;
use std::sync::LazyLock;

pub const FIELD_SEPARATOR: char = '\u{1F}';

const TAG_WIDTH: usize = 24;
const DESCRIPTION_WIDTH: usize = 48;
const CYAN: &str = "\u{1B}[36m";
const BLUE: &str = "\u{1B}[34m";
const YELLOW: &str = "\u{1B}[33m";
const RESET: &str = "\u{1B}[0m";

const TAGS_HEADER: &str = "TAGS";
const DESCRIPTION_HEADER: &str = "DESCRIPTION :: ALIAS";
const COMMAND_HEADER: &str = "COMMAND";

pub const FZF_LINE_OPTIONS: [&str; 7] = [
    "--ansi",
    "--delimiter",
    "\u{1F}",
    "--with-nth",
    "2..",
    "--nth",
    "2",
];

static LINE_BREAK: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s*\n\s*").expect("line break pattern is valid"));

pub fn utf16_len(text: &str) -> usize {
    text.encode_utf16().count()
}

fn pad(text: &str, width: usize) -> String {
    let padding = width.saturating_sub(utf16_len(text));
    format!("{text}{}", " ".repeat(padding))
}

fn column_width(values: impl Iterator<Item = usize>, max: usize) -> usize {
    max.min(values.max().unwrap_or(0))
}

fn one_line(text: &str) -> String {
    LINE_BREAK
        .replace_all_literal(text, " ; ")
        .trim()
        .to_string()
}

fn describe(entry: &Entry) -> String {
    match &entry.alias {
        None => entry.description.clone(),
        Some(alias) => format!("{} :: {alias}", entry.description),
    }
}

fn tag_text(item: &Item) -> String {
    item.section.tags.join(", ")
}

struct Widths {
    tag: usize,
    description: usize,
}

fn widths(list: &[Item]) -> Widths {
    let tags = std::iter::once(utf16_len(TAGS_HEADER))
        .chain(list.iter().map(|item| utf16_len(&tag_text(item))));
    let descriptions = std::iter::once(utf16_len(DESCRIPTION_HEADER))
        .chain(list.iter().map(|item| utf16_len(&describe(item.entry))));
    Widths {
        tag: column_width(tags, TAG_WIDTH),
        description: column_width(descriptions, DESCRIPTION_WIDTH),
    }
}

pub fn format_header(list: &[Item], channel_name: Option<&str>) -> String {
    let widths = widths(list);
    let columns = format!(
        "{}  {}  {COMMAND_HEADER}",
        pad(TAGS_HEADER, widths.tag),
        pad(DESCRIPTION_HEADER, widths.description)
    );
    match channel_name {
        None => columns,
        Some(name) => format!("channel: {name}\n{columns}"),
    }
}

/// The command is separated from the display columns so fzf searches only commands.
/// The index is hidden by --with-nth and preserved in fzf's output.
pub fn format_lines(list: &[Item]) -> Vec<String> {
    let widths = widths(list);
    list.iter()
        .enumerate()
        .map(|(index, item)| {
            let entry = item.entry;
            let description = match &entry.alias {
                None => format!(
                    "{BLUE}{}{RESET}",
                    pad(&entry.description, widths.description)
                ),
                Some(alias) => format!(
                    "{BLUE}{}{RESET} :: {YELLOW}{alias}{RESET}{}",
                    entry.description,
                    " ".repeat(
                        widths
                            .description
                            .saturating_sub(utf16_len(&describe(entry)))
                    )
                ),
            };
            format!(
                "{index}{FIELD_SEPARATOR}{CYAN}{}{RESET}  {description}  {FIELD_SEPARATOR}{}",
                pad(&tag_text(item), widths.tag),
                one_line(&entry.command)
            )
        })
        .collect()
}

pub fn js_parse_int(line: &str) -> Option<i64> {
    let field = line
        .split(FIELD_SEPARATOR)
        .next()
        .unwrap_or("")
        .trim_start();
    let (negative, digits) = match field.as_bytes().first() {
        Some(b'-') => (true, &field[1..]),
        Some(b'+') => (false, &field[1..]),
        _ => (false, field),
    };
    let end = digits
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(digits.len());
    let value: i64 = digits[..end].parse().ok()?;
    Some(if negative { -value } else { value })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::items;
    use crate::testing::config;

    fn strip_ansi(text: &str) -> String {
        Regex::new("\u{1B}\\[[0-9;]*m")
            .unwrap()
            .replace_all_literal(text, "")
    }

    #[test]
    fn aligns_the_header_with_the_entry_columns() {
        let config = config();
        let list = items(&config, None);
        let header = format_header(&list, None);
        let plain: Vec<String> = format_lines(&list)
            .iter()
            .map(|line| strip_ansi(&line.split(FIELD_SEPARATOR).skip(1).collect::<String>()))
            .collect();
        assert_eq!(plain[0].find("codex-statusline"), header.find("COMMAND"));
        assert_eq!(
            format_header(&list, Some("docker")).lines().next(),
            Some("channel: docker")
        );
    }

    #[test]
    fn round_trips_the_selected_index_through_the_fzf_line() {
        let config = config();
        let list = items(&config, None);
        let lines = format_lines(&list);
        assert_eq!(lines.len(), list.len());
        assert_eq!(js_parse_int(&lines[2]), Some(2));
        assert!(lines[1].contains("codexu"));
        assert_eq!(
            lines[1].split(FIELD_SEPARATOR).nth(2),
            Some("codex --config model_reasoning_effort=ultra")
        );
    }

    #[test]
    fn parses_selection_like_parse_int() {
        assert_eq!(js_parse_int("12\u{1F}rest"), Some(12));
        assert_eq!(js_parse_int(""), None);
        assert_eq!(js_parse_int("x\u{1F}"), None);
    }
}
