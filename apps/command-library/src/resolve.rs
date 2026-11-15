use crate::candidates::{Candidates, parse_candidates};
use crate::library::{Item, Variable, extract_column, placeholders, substitute};
use std::collections::HashMap;

pub trait Prompter {
    /// Runs a variable command and returns its stdout.
    fn run(&mut self, command: &str) -> String;
    /// Lets the user pick values; returns `None` when cancelled.
    fn choose(
        &mut self,
        name: &str,
        variable: &Variable,
        candidates: &Candidates,
        header: &str,
    ) -> Result<Option<Vec<String>>, String>;
    /// Asks for free text; returns `None` when cancelled.
    fn input(&mut self, name: &str, header: &str) -> Result<Option<String>, String>;
}

enum Stop {
    Cancelled,
    Failed(String),
}

impl From<String> for Stop {
    fn from(message: String) -> Self {
        Self::Failed(message)
    }
}

fn choose_value(
    name: &str,
    variable: &Variable,
    candidates: &Candidates,
    header: &str,
    prompter: &mut dyn Prompter,
) -> Result<String, Stop> {
    if candidates.values.is_empty() {
        return prompter.input(name, header)?.ok_or(Stop::Cancelled);
    }
    let selected = if variable.select_one && candidates.values.len() == 1 {
        candidates.values.clone()
    } else {
        prompter
            .choose(name, variable, candidates, header)?
            .unwrap_or_default()
    };
    if selected.is_empty() {
        return Err(Stop::Cancelled);
    }
    let columns: Result<Vec<String>, String> = selected
        .iter()
        .map(|line| extract_column(line, variable.column, variable.delimiter.as_deref()))
        .collect();
    Ok(columns?.join(" "))
}

fn resolve(
    item: &Item,
    name: &str,
    stack: &[String],
    values: &mut HashMap<String, String>,
    prompter: &mut dyn Prompter,
) -> Result<(), Stop> {
    if values.contains_key(name) {
        return Ok(());
    }
    let command = &item.entry.command;
    let Some(variable) = item.section.variables.get(name) else {
        let header = substitute(command, values);
        let value = prompter.input(name, &header)?.ok_or(Stop::Cancelled)?;
        values.insert(name.to_string(), value);
        return Ok(());
    };
    let mut next_stack = stack.to_vec();
    next_stack.push(name.to_string());
    for dependency in placeholders(variable.command.as_deref().unwrap_or("")) {
        if !next_stack.contains(&dependency) {
            resolve(item, &dependency, &next_stack, values, prompter)?;
        }
    }
    let output = match &variable.command {
        None => String::new(),
        Some(variable_command) => prompter.run(&substitute(variable_command, values)),
    };
    let candidates = parse_candidates(variable, &output)?;
    let header = substitute(command, values);
    let value = choose_value(name, variable, &candidates, &header, prompter)?;
    values.insert(name.to_string(), value);
    Ok(())
}

/// Fills every <placeholder> in the entry command, resolving placeholders
/// referenced by variable commands first. Returns `Ok(None)` when the user cancels.
pub fn resolve_command(item: &Item, prompter: &mut dyn Prompter) -> Result<Option<String>, String> {
    let command = &item.entry.command;
    let mut values = HashMap::new();
    for name in placeholders(command) {
        match resolve(item, &name, &[], &mut values, prompter) {
            Ok(()) => {}
            Err(Stop::Cancelled) => return Ok(None),
            Err(Stop::Failed(message)) => return Err(message),
        }
    }
    Ok(Some(substitute(command, &values)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::{Entry, Section};

    #[derive(Default)]
    struct Fake {
        outputs: HashMap<String, String>,
        choices: HashMap<String, Vec<String>>,
        texts: HashMap<String, String>,
        ran: Vec<String>,
        asked: Vec<String>,
    }

    impl Prompter for Fake {
        fn run(&mut self, command: &str) -> String {
            self.ran.push(command.to_string());
            self.outputs.get(command).cloned().unwrap_or_default()
        }
        fn choose(
            &mut self,
            name: &str,
            _: &Variable,
            _: &Candidates,
            _: &str,
        ) -> Result<Option<Vec<String>>, String> {
            self.asked.push(name.to_string());
            Ok(self.choices.get(name).cloned())
        }
        fn input(&mut self, name: &str, _: &str) -> Result<Option<String>, String> {
            self.asked.push(name.to_string());
            Ok(self.texts.get(name).cloned())
        }
    }

    fn map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    fn section(variables: Vec<(&str, Variable)>) -> Section {
        Section {
            tags: vec!["t".to_string()],
            variables: variables
                .into_iter()
                .map(|(name, variable)| (name.to_string(), variable))
                .collect(),
            ..Section::default()
        }
    }

    fn entry(command: &str) -> Entry {
        Entry {
            description: "d".to_string(),
            alias: None,
            command: command.to_string(),
        }
    }

    #[test]
    fn resolves_dependencies_before_dependent_variables() {
        let mut fake = Fake {
            outputs: map(&[
                ("aws configure list-profiles", "dev\nprod\n"),
                ("aws --profile prod ec2", "web\ti-1\napi\ti-2\n"),
            ]),
            choices: HashMap::from([
                ("profile".to_string(), vec!["prod".to_string()]),
                ("target".to_string(), vec!["api\ti-2".to_string()]),
            ]),
            ..Fake::default()
        };
        let section = section(vec![
            (
                "profile",
                Variable {
                    command: Some("aws configure list-profiles".to_string()),
                    ..Variable::default()
                },
            ),
            (
                "target",
                Variable {
                    command: Some("aws --profile <profile> ec2".to_string()),
                    column: Some(2),
                    select_one: false,
                    ..Variable::default()
                },
            ),
        ]);
        let entry = entry("aws --profile <profile> ssm start-session --target <target>");
        let result = resolve_command(
            &Item {
                section: &section,
                entry: &entry,
            },
            &mut fake,
        );
        assert_eq!(
            result,
            Ok(Some(
                "aws --profile prod ssm start-session --target i-2".to_string()
            ))
        );
        assert_eq!(
            fake.ran,
            ["aws configure list-profiles", "aws --profile prod ec2"]
        );
    }

    #[test]
    fn auto_selects_a_single_candidate_and_prompts_for_free_text() {
        let mut fake = Fake {
            outputs: map(&[(
                "echo git@github.com:me/dots.git",
                "git@github.com:me/dots.git\n",
            )]),
            texts: map(&[("username", "me"), ("repo", "dots")]),
            ..Fake::default()
        };
        let section = section(vec![(
            "git_repo",
            Variable {
                command: Some("echo git@github.com:<username>/<repo>.git".to_string()),
                ..Variable::default()
            },
        )]);
        let entry = entry("ghq get <git_repo>");
        let result = resolve_command(
            &Item {
                section: &section,
                entry: &entry,
            },
            &mut fake,
        );
        assert_eq!(
            result,
            Ok(Some("ghq get git@github.com:me/dots.git".to_string()))
        );
        assert_eq!(fake.asked, ["username", "repo"]);
    }

    #[test]
    fn skips_header_lines_and_joins_multiple_selections() {
        let mut fake = Fake {
            outputs: map(&[(
                "docker ps",
                "CONTAINER ID   IMAGE\nabc   nginx\ndef   redis\n",
            )]),
            choices: HashMap::from([(
                "ids".to_string(),
                vec!["abc   nginx".to_string(), "def   redis".to_string()],
            )]),
            ..Fake::default()
        };
        let section = section(vec![(
            "ids",
            Variable {
                command: Some("docker ps".to_string()),
                headers: 1,
                column: Some(1),
                multi: true,
                ..Variable::default()
            },
        )]);
        let entry = entry("docker stop <ids>");
        let result = resolve_command(
            &Item {
                section: &section,
                entry: &entry,
            },
            &mut fake,
        );
        assert_eq!(result, Ok(Some("docker stop abc def".to_string())));
    }

    #[test]
    fn returns_none_when_cancelled() {
        let mut fake = Fake::default();
        let section = section(vec![]);
        let entry = entry("tar czf <output>.tar.gz");
        let result = resolve_command(
            &Item {
                section: &section,
                entry: &entry,
            },
            &mut fake,
        );
        assert_eq!(result, Ok(None));
    }
}
