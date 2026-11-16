use crate::config::{Config, Entry, Section};
use crate::error::{Error, Result};
use dot::regex::{Captures, Regex};
use std::collections::HashMap;
use std::iter;
use std::sync::LazyLock;

pub trait Environment {
    fn cwd(&self) -> &str;
    fn home(&self) -> &str;
    fn exists(&self, path: &str) -> bool;
    fn has_command(&self, name: &str) -> bool;
}

#[derive(Debug, Clone, Copy)]
pub struct Item<'a> {
    pub section: &'a Section,
    pub entry: &'a Entry,
}

const DEFAULT_DELIMITER: &str = "\\s{2,}|\\t";

static PLACEHOLDER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"<([A-Za-z0-9_-]+)>").expect("placeholder pattern is valid"));

pub fn regex(pattern: &str) -> Result<Regex> {
    Regex::new(pattern)
        .map_err(|error| Error::failure(format!("invalid regex {pattern:?}: {error}")))
}

fn expand_home(path: &str, home: &str) -> String {
    match path.strip_prefix('~') {
        Some("") => home.to_string(),
        Some(rest) if rest.starts_with('/') => format!("{home}{rest}"),
        _ => path.to_string(),
    }
}

fn is_under(cwd: &str, directory: &str) -> bool {
    let base = directory.trim_end_matches('/');
    cwd.strip_prefix(base)
        .is_some_and(|rest| rest.is_empty() || rest.starts_with('/'))
}

fn search_directories(cwd: &str, parents: bool) -> Vec<&str> {
    if !parents {
        return vec![cwd];
    }
    let start = Some(cwd.trim_end_matches('/')).filter(|dir| !dir.is_empty());
    iter::successors(start, |dir| {
        Some(&dir[..dir.rfind('/').unwrap_or(0)]).filter(|parent| !parent.is_empty())
    })
    .chain(iter::once(""))
    .collect()
}

pub fn is_active(section: &Section, env: &dyn Environment) -> bool {
    let Some(when) = &section.when else {
        return true;
    };
    let in_path = when.paths.is_empty()
        || when
            .paths
            .iter()
            .any(|path| is_under(env.cwd(), &expand_home(path, env.home())));
    let has_file = when.files.is_empty()
        || search_directories(env.cwd(), when.search_parents)
            .iter()
            .any(|directory| {
                when.files
                    .iter()
                    .any(|file| env.exists(&format!("{directory}/{file}")))
            });
    in_path && has_file && when.commands.iter().all(|command| env.has_command(command))
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

/// The matched channel is removed from the query used to search commands.
pub fn channel<'a>(list: &[Item<'a>], query: &str) -> Channel<'a> {
    let word = query.split_whitespace().next().unwrap_or("");
    let matches: Vec<Item> = list
        .iter()
        .filter(|item| {
            !word.is_empty()
                && item
                    .section
                    .tags
                    .iter()
                    .any(|tag| tag.split(char::is_whitespace).next() == Some(word))
        })
        .copied()
        .collect();
    if matches.is_empty() {
        return Channel {
            name: None,
            items: list.to_vec(),
            query: query.to_string(),
        };
    }
    Channel {
        name: Some(word.to_string()),
        items: matches,
        query: query.trim()[word.len()..].trim().to_string(),
    }
}

pub fn placeholders(command: &str) -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    for captures in PLACEHOLDER.captures_iter(command) {
        let name = &captures[1];
        if !names.iter().any(|known| known == name) {
            names.push(name.to_string());
        }
    }
    names
}

pub fn substitute(command: &str, values: &HashMap<String, String>) -> String {
    PLACEHOLDER.replace_all(command, |captures: &Captures| {
        values
            .get(&captures[1])
            .map_or_else(|| captures[0].to_string(), Clone::clone)
    })
}

pub fn extract_column(
    line: &str,
    column: Option<usize>,
    delimiter: Option<&str>,
) -> Result<String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::When;
    use crate::testing::{config, entry};

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
            existing: existing.iter().map(ToString::to_string).collect(),
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
        values.iter().map(ToString::to_string).collect()
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
