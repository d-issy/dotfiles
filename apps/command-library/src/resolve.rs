use crate::candidates::{Candidates, parse_candidates};
use crate::config::Variable;
use crate::error::{Error, Result};
use crate::library::{Item, extract_column, placeholders, substitute};
use std::collections::HashMap;

pub trait Prompter {
    fn run(&mut self, command: &str) -> String;
    fn choose(
        &mut self,
        name: &str,
        variable: &Variable,
        candidates: &Candidates,
        header: &str,
    ) -> Result<Option<Vec<String>>>;
    fn input(&mut self, name: &str, header: &str) -> Result<Option<String>>;
}

enum Stop {
    Cancelled,
    Failed(Error),
}

impl From<Error> for Stop {
    fn from(error: Error) -> Self {
        Self::Failed(error)
    }
}

struct Resolver<'a, 'p> {
    item: Item<'a>,
    values: HashMap<String, String>,
    prompter: &'p mut dyn Prompter,
}

impl Resolver<'_, '_> {
    fn header(&self) -> String {
        substitute(&self.item.entry.command, &self.values)
    }

    fn ask(&mut self, name: &str) -> std::result::Result<String, Stop> {
        let header = self.header();
        self.prompter.input(name, &header)?.ok_or(Stop::Cancelled)
    }

    fn pick(
        &mut self,
        name: &str,
        variable: &Variable,
        candidates: &Candidates,
    ) -> std::result::Result<String, Stop> {
        if candidates.values.is_empty() {
            return self.ask(name);
        }
        let selected = if variable.select_one && candidates.values.len() == 1 {
            candidates.values.clone()
        } else {
            let header = self.header();
            self.prompter
                .choose(name, variable, candidates, &header)?
                .unwrap_or_default()
        };
        if selected.is_empty() {
            return Err(Stop::Cancelled);
        }
        let columns = selected
            .iter()
            .map(|line| extract_column(line, variable.column, variable.delimiter.as_deref()))
            .collect::<Result<Vec<_>>>()?;
        Ok(columns.join(" "))
    }

    fn resolve(&mut self, name: &str, stack: &[String]) -> std::result::Result<(), Stop> {
        if self.values.contains_key(name) {
            return Ok(());
        }
        let Some(variable) = self.item.section.variables.get(name) else {
            let value = self.ask(name)?;
            self.values.insert(name.to_string(), value);
            return Ok(());
        };
        let mut stack = stack.to_vec();
        stack.push(name.to_string());
        for dependency in placeholders(variable.command.as_deref().unwrap_or("")) {
            if !stack.contains(&dependency) {
                self.resolve(&dependency, &stack)?;
            }
        }
        let output = variable
            .command
            .as_ref()
            .map(|command| self.prompter.run(&substitute(command, &self.values)))
            .unwrap_or_default();
        let candidates = parse_candidates(variable, &output)?;
        let value = self.pick(name, variable, &candidates)?;
        self.values.insert(name.to_string(), value);
        Ok(())
    }
}

pub fn resolve_command(item: &Item, prompter: &mut dyn Prompter) -> Result<Option<String>> {
    let command = &item.entry.command;
    let mut resolver = Resolver {
        item: *item,
        values: HashMap::new(),
        prompter,
    };
    for name in placeholders(command) {
        match resolver.resolve(&name, &[]) {
            Ok(()) => {}
            Err(Stop::Cancelled) => return Ok(None),
            Err(Stop::Failed(error)) => return Err(error),
        }
    }
    Ok(Some(resolver.header()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{Entry, Section};

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
        ) -> Result<Option<Vec<String>>> {
            self.asked.push(name.to_string());
            Ok(self.choices.get(name).cloned())
        }
        fn input(&mut self, name: &str, _: &str) -> Result<Option<String>> {
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
