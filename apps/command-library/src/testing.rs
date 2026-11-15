use crate::config::{Config, Entry, FzfConfig, Section};

pub fn entry(description: &str, alias: Option<&str>, command: &str) -> Entry {
    Entry {
        description: description.to_string(),
        alias: alias.map(str::to_string),
        command: command.to_string(),
    }
}

pub fn section(tags: &[&str], entries: Vec<Entry>) -> Section {
    Section {
        tags: tags.iter().map(ToString::to_string).collect(),
        entries,
        ..Section::default()
    }
}

pub fn config() -> Config {
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
