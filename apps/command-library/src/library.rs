use regex::Regex;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct Replacement {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Variable {
    /// Shell command producing candidates; `None` when `values` is used.
    pub command: Option<String>,
    pub values: Vec<String>,
    pub json: Option<String>,
    pub separator: Option<String>,
    pub r#match: Option<String>,
    pub replace: Vec<Replacement>,
    pub unique: bool,
    pub sort: bool,
    pub column: Option<usize>,
    pub headers: usize,
    pub delimiter: Option<String>,
    pub multi: bool,
    pub select_one: bool,
}

impl Default for Variable {
    fn default() -> Self {
        Self {
            command: None,
            values: Vec::new(),
            json: None,
            separator: None,
            r#match: None,
            replace: Vec::new(),
            unique: false,
            sort: false,
            column: None,
            headers: 0,
            delimiter: None,
            multi: false,
            select_one: true,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct Entry {
    pub description: String,
    pub alias: Option<String>,
    pub command: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct When {
    pub paths: Vec<String>,
    pub files: Vec<String>,
    /// Also look for `files` in parent directories (e.g. just's justfile).
    pub search_parents: bool,
    pub commands: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct Section {
    pub tags: Vec<String>,
    pub variables: HashMap<String, Variable>,
    pub entries: Vec<Entry>,
    pub when: Option<When>,
}

pub trait Environment {
    fn cwd(&self) -> &str;
    fn home(&self) -> &str;
    fn exists(&self, path: &str) -> bool;
    fn has_command(&self, name: &str) -> bool;
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct FzfConfig {
    pub command: String,
    pub options: Vec<String>,
    pub variable_options: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct Config {
    pub fzf: FzfConfig,
    pub sections: Vec<Section>,
}

#[derive(Debug, Clone, Copy)]
pub struct Item<'a> {
    pub section: &'a Section,
    pub entry: &'a Entry,
}

/// Default column delimiter: runs of two or more spaces, or a tab.
const DEFAULT_DELIMITER: &str = "\\s{2,}|\\t";
const FIELD_SEPARATOR: char = '\u{1F}';

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

pub fn regex(pattern: &str) -> Result<Regex, String> {
    Regex::new(pattern).map_err(|error| format!("invalid regex {pattern:?}: {error}"))
}

pub fn load_config(path: &str) -> Result<Config, String> {
    let text = std::fs::read_to_string(path).map_err(|error| format!("{path}: {error}"))?;
    serde_json::from_str(&text).map_err(|error| format!("{path}: {error}"))
}

/// Length in UTF-16 code units, matching how widths were measured before.
pub fn text_len(text: &str) -> usize {
    text.encode_utf16().count()
}

fn expand_home(path: &str, home: &str) -> String {
    if path == "~" {
        home.to_string()
    } else if let Some(rest) = path.strip_prefix("~/") {
        format!("{home}/{rest}")
    } else {
        path.to_string()
    }
}

fn is_under(cwd: &str, directory: &str) -> bool {
    let base = directory.trim_end_matches('/');
    cwd == base || cwd.starts_with(&format!("{base}/"))
}

fn search_directories(cwd: &str, parents: bool) -> Vec<String> {
    if !parents {
        return vec![cwd.to_string()];
    }
    let mut directories = Vec::new();
    let mut current = cwd.trim_end_matches('/').to_string();
    while !current.is_empty() {
        directories.push(current.clone());
        current.truncate(current.rfind('/').unwrap_or(0));
    }
    directories.push(String::new());
    directories
}

/// A section is active when every configured condition holds: the cwd is under
/// one of `paths`, one of `files` exists in the cwd, and all `commands` exist.
pub fn is_active(section: &Section, env: &dyn Environment) -> bool {
    let Some(when) = &section.when else {
        return true;
    };
    if !when.paths.is_empty()
        && !when
            .paths
            .iter()
            .any(|path| is_under(env.cwd(), &expand_home(path, env.home())))
    {
        return false;
    }
    if !when.files.is_empty()
        && !search_directories(env.cwd(), when.search_parents)
            .iter()
            .any(|directory| {
                when.files
                    .iter()
                    .any(|file| env.exists(&format!("{directory}/{file}")))
            })
    {
        return false;
    }
    when.commands.iter().all(|command| env.has_command(command))
}

pub fn items<'a>(config: &'a Config, env: Option<&dyn Environment>) -> Vec<Item<'a>> {
    config
        .sections
        .iter()
        .filter(|section| env.is_none_or(|env| is_active(section, env)))
        .flat_map(|section| {
            section
                .entries
                .iter()
                .map(move |entry| Item { section, entry })
        })
        .collect()
}

pub fn find_alias<'a>(list: &[Item<'a>], query: &str) -> Option<Item<'a>> {
    let name = query.trim();
    if name.is_empty() {
        return None;
    }
    list.iter()
        .find(|item| item.entry.alias.as_deref() == Some(name))
        .copied()
}

pub struct Channel<'a> {
    pub name: Option<String>,
    pub items: Vec<Item<'a>>,
    pub query: String,
}

/// Narrows to the sections whose tags start with the first word of the
/// command line (e.g. "docker ..." -> docker), or keeps every item.
/// A matched channel is removed from the query used to search commands.
pub fn channel<'a>(list: &[Item<'a>], query: &str) -> Channel<'a> {
    let word = query.split_whitespace().next().unwrap_or("");
    let keep_all = || Channel {
        name: None,
        items: list.to_vec(),
        query: query.to_string(),
    };
    if word.is_empty() {
        return keep_all();
    }
    let matches: Vec<Item> = list
        .iter()
        .filter(|item| {
            item.section
                .tags
                .iter()
                .any(|tag| tag.split(char::is_whitespace).next() == Some(word))
        })
        .copied()
        .collect();
    if matches.is_empty() {
        return keep_all();
    }
    Channel {
        name: Some(word.to_string()),
        items: matches,
        query: query.trim()[word.len()..].trim().to_string(),
    }
}

fn placeholder_regex() -> Regex {
    // Matches placeholders such as <name> or <main-file>.
    Regex::new(r"<([A-Za-z0-9_-]+)>").expect("placeholder pattern is valid")
}

pub fn placeholders(command: &str) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for captures in placeholder_regex().captures_iter(command) {
        let name = &captures[1];
        if !names.iter().any(|known| known == name) {
            names.push(name.to_string());
        }
    }
    names
}

pub fn substitute(command: &str, values: &HashMap<String, String>) -> String {
    placeholder_regex()
        .replace_all(command, |captures: &regex::Captures| {
            values
                .get(&captures[1])
                .cloned()
                .unwrap_or_else(|| captures[0].to_string())
        })
        .into_owned()
}

pub fn extract_column(
    line: &str,
    column: Option<usize>,
    delimiter: Option<&str>,
) -> Result<String, String> {
    let Some(column) = column else {
        return Ok(line.to_string());
    };
    let pattern = regex(delimiter.unwrap_or(DEFAULT_DELIMITER))?;
    let field = pattern
        .split(line)
        .nth(column.saturating_sub(1))
        .unwrap_or("");
    Ok(field.trim().to_string())
}

fn pad(text: &str, width: usize) -> String {
    let length = text_len(text);
    if length >= width {
        text.to_string()
    } else {
        format!("{text}{}", " ".repeat(width - length))
    }
}

fn column_width(values: &[String], max: usize) -> usize {
    max.min(
        values
            .iter()
            .map(|value| text_len(value))
            .max()
            .unwrap_or(0),
    )
}

fn one_line(text: &str) -> String {
    let pattern = Regex::new(r"\s*\n\s*").expect("newline pattern is valid");
    pattern.replace_all(text, " ; ").trim().to_string()
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

fn widths(list: &[Item]) -> (usize, usize) {
    let tags: Vec<String> = std::iter::once(TAGS_HEADER.to_string())
        .chain(list.iter().map(tag_text))
        .collect();
    let descriptions: Vec<String> = std::iter::once(DESCRIPTION_HEADER.to_string())
        .chain(list.iter().map(|item| describe(item.entry)))
        .collect();
    (
        column_width(&tags, TAG_WIDTH),
        column_width(&descriptions, DESCRIPTION_WIDTH),
    )
}

/// Column titles aligned with `format_lines`, plus the active channel if any.
pub fn format_header(list: &[Item], channel_name: Option<&str>) -> String {
    let (tag, description) = widths(list);
    let columns = format!(
        "{}  {}  {COMMAND_HEADER}",
        pad(TAGS_HEADER, tag),
        pad(DESCRIPTION_HEADER, description)
    );
    match channel_name {
        None => columns,
        Some(name) => format!("channel: {name}\n{columns}"),
    }
}

/// Separate the command from the display columns so fzf can search only commands.
/// The index is hidden by --with-nth and preserved in fzf's output.
pub fn format_lines(list: &[Item]) -> Vec<String> {
    let (tag_width, description_width) = widths(list);
    list.iter()
        .enumerate()
        .map(|(index, item)| {
            let entry = item.entry;
            let description = match &entry.alias {
                None => format!(
                    "{BLUE}{}{RESET}",
                    pad(&entry.description, description_width)
                ),
                Some(alias) => format!(
                    "{BLUE}{}{RESET} :: {YELLOW}{alias}{RESET}{}",
                    entry.description,
                    " ".repeat(description_width.saturating_sub(text_len(&describe(entry))))
                ),
            };
            format!(
                "{index}{FIELD_SEPARATOR}{CYAN}{}{RESET}  {description}  {FIELD_SEPARATOR}{}",
                pad(&tag_text(item), tag_width),
                one_line(&entry.command)
            )
        })
        .collect()
}

/// Mirrors `Number.parseInt(first_field, 10)`: leading spaces, optional sign, digits.
pub fn parse_selection(line: &str) -> Option<i64> {
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

    fn entry(description: &str, alias: Option<&str>, command: &str) -> Entry {
        Entry {
            description: description.to_string(),
            alias: alias.map(str::to_string),
            command: command.to_string(),
        }
    }

    fn section(tags: &[&str], entries: Vec<Entry>) -> Section {
        Section {
            tags: tags.iter().map(|tag| tag.to_string()).collect(),
            entries,
            ..Section::default()
        }
    }

    fn config() -> Config {
        Config {
            fzf: FzfConfig {
                command: "fzf".to_string(),
                ..FzfConfig::default()
            },
            sections: vec![
                section(
                    &["aliases"],
                    vec![
                        entry("shell alias", Some("codex"), "codex-statusline"),
                        entry(
                            "shell alias",
                            Some("codexu"),
                            "codex --config model_reasoning_effort=ultra",
                        ),
                        entry("shell alias", Some("cla"), "claude --permission-mode auto"),
                    ],
                ),
                section(
                    &["nix agent-sessions"],
                    vec![entry(
                        "watch Claude Code and Codex sessions live",
                        Some("agent-sessions"),
                        "nix run .#agent-sessions",
                    )],
                ),
                section(&["docker"], vec![entry("docker ps", None, "docker ps")]),
            ],
        }
    }

    fn commands<'a>(list: &[Item<'a>]) -> Vec<&'a str> {
        list.iter()
            .map(|item| item.entry.command.as_str())
            .collect()
    }

    #[test]
    fn expands_only_exact_aliases() {
        let config = config();
        let list = items(&config, None);
        assert_eq!(
            find_alias(&list, "codexu").map(|i| i.entry.command.as_str()),
            Some("codex --config model_reasoning_effort=ultra")
        );
        assert_eq!(
            find_alias(&list, " cla ").map(|i| i.entry.command.as_str()),
            Some("claude --permission-mode auto")
        );
        assert!(find_alias(&list, "codexu2").is_none());
        assert!(find_alias(&list, "").is_none());
    }

    #[test]
    fn narrows_to_the_channel_matching_the_first_word() {
        let config = config();
        let list = items(&config, None);
        let docker = channel(&list, "docker lo");
        assert_eq!(docker.name.as_deref(), Some("docker"));
        assert_eq!(docker.query, "lo");
        assert_eq!(commands(&docker.items), ["docker ps"]);
        assert_eq!(
            commands(&channel(&list, "nix").items),
            ["nix run .#agent-sessions"]
        );
        let unknown = channel(&list, "unknown");
        assert!(unknown.name.is_none());
        assert_eq!(unknown.items.len(), list.len());
        assert_eq!(unknown.query, "unknown");
    }

    #[test]
    fn clears_channel_only_queries_and_preserves_the_remaining_query() {
        let config = config();
        let list = items(&config, None);
        assert_eq!(channel(&list, " nix ").query, "");
        assert_eq!(channel(&list, " nix   run .#apply ").query, "run .#apply");
    }

    fn strip_ansi(text: &str) -> String {
        Regex::new("\u{1B}\\[[0-9;]*m")
            .unwrap()
            .replace_all(text, "")
            .into_owned()
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
        assert_eq!(parse_selection(&lines[2]), Some(2));
        assert!(lines[1].contains("codexu"));
        assert_eq!(
            lines[1].split(FIELD_SEPARATOR).nth(2),
            Some("codex --config model_reasoning_effort=ultra")
        );
    }

    #[test]
    fn lists_unique_placeholders_in_order() {
        assert_eq!(
            placeholders("zip -r <output>.zip <files> <output>"),
            ["output", "files"]
        );
    }

    #[test]
    fn substitutes_known_values_and_keeps_unknown_ones() {
        let values = HashMap::from([("main-file".to_string(), "a.go".to_string())]);
        assert_eq!(
            substitute("go run <main-file> <x>", &values),
            "go run a.go <x>"
        );
    }

    #[test]
    fn extracts_columns() {
        assert_eq!(
            extract_column("12\ttitle here\tbranch", Some(1), Some("\\t")).unwrap(),
            "12"
        );
        assert_eq!(
            extract_column("nginx   latest   abc123   2 days ago", Some(3), None).unwrap(),
            "abc123"
        );
        assert_eq!(
            extract_column("whole line", None, None).unwrap(),
            "whole line"
        );
    }

    #[test]
    fn parses_selection_like_parse_int() {
        assert_eq!(parse_selection("12\u{1F}rest"), Some(12));
        assert_eq!(parse_selection(""), None);
        assert_eq!(parse_selection("x\u{1F}"), None);
    }

    struct FakeEnv {
        cwd: String,
        existing: Vec<String>,
        commands: Vec<String>,
    }

    impl Environment for FakeEnv {
        fn cwd(&self) -> &str {
            &self.cwd
        }
        fn home(&self) -> &str {
            "/home/me"
        }
        fn exists(&self, path: &str) -> bool {
            self.existing.iter().any(|known| known == path)
        }
        fn has_command(&self, name: &str) -> bool {
            self.commands.iter().any(|known| known == name)
        }
    }

    const CWD: &str = "/home/me/code/github.com/d-issy/dotfiles/apps";

    fn env(existing: &[&str]) -> FakeEnv {
        FakeEnv {
            cwd: CWD.to_string(),
            existing: existing.iter().map(|path| path.to_string()).collect(),
            commands: vec!["make".to_string()],
        }
    }

    fn scoped(when: When) -> Section {
        Section {
            tags: vec!["t".to_string()],
            entries: vec![entry("d", None, "c")],
            when: Some(when),
            ..Section::default()
        }
    }

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn is_active_without_conditions() {
        let env = env(&[]);
        assert!(is_active(&scoped(When::default()), &env));
        assert!(is_active(&Section::default(), &env));
    }

    #[test]
    fn matches_paths_under_a_directory_with_home_expanded() {
        let env = env(&[]);
        let under = |path: &str| {
            is_active(
                &scoped(When {
                    paths: strings(&[path]),
                    ..When::default()
                }),
                &env,
            )
        };
        assert!(under("~/code/github.com/d-issy/dotfiles"));
        assert!(!under("~/code/github.com/d-issy/dot"));
    }

    #[test]
    fn requires_one_of_the_files_in_the_current_directory() {
        let env = env(&["/home/me/code/github.com/d-issy/dotfiles/apps/Makefile"]);
        let with_files = |files: &[&str]| {
            is_active(
                &scoped(When {
                    files: strings(files),
                    ..When::default()
                }),
                &env,
            )
        };
        assert!(with_files(&["justfile", "Makefile"]));
        assert!(!with_files(&["justfile"]));
    }

    #[test]
    fn searches_parent_directories_only_when_asked() {
        let when = |search_parents| When {
            files: strings(&["justfile"]),
            search_parents,
            ..When::default()
        };
        let parent = env(&["/home/me/code/github.com/d-issy/dotfiles/justfile"]);
        assert!(!is_active(&scoped(when(false)), &parent));
        assert!(is_active(&scoped(when(true)), &parent));
        let root = env(&["/justfile"]);
        assert!(is_active(&scoped(when(true)), &root));
    }

    #[test]
    fn requires_every_command() {
        let env = env(&[]);
        let with_commands = |commands: &[&str]| {
            is_active(
                &scoped(When {
                    commands: strings(commands),
                    ..When::default()
                }),
                &env,
            )
        };
        assert!(with_commands(&["make"]));
        assert!(!with_commands(&["make", "just"]));
    }

    #[test]
    fn drops_inactive_sections_from_items_and_alias_expansion() {
        let mut scoped_config = config();
        let mut section = scoped(When {
            files: strings(&["justfile"]),
            ..When::default()
        });
        section.entries = vec![entry("d", Some("just"), "just <recipe>")];
        scoped_config.sections.push(section);
        let env = env(&["/home/me/code/github.com/d-issy/dotfiles/apps/Makefile"]);
        assert!(find_alias(&items(&scoped_config, None), "just").is_some());
        assert!(find_alias(&items(&scoped_config, Some(&env)), "just").is_none());
        assert!(find_alias(&items(&scoped_config, Some(&env)), "codexu").is_some());
    }
}
