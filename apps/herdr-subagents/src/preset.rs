use crate::error::{Error, JQ_RUNTIME_ERROR, Result, die};
use crate::herdr::capture_stdout;
use crate::json;
use crate::version;
use dot::json::Value;
use dot::process::is_on_path;
use std::fmt;
use std::str::FromStr;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Preset {
    Pi,
    Astra,
    Sol,
    Luna,
    Opus,
    Fable,
    Grok,
    Composer,
}

impl FromStr for Preset {
    type Err = Error;

    fn from_str(text: &str) -> Result<Self> {
        Ok(match text {
            "pi" => Self::Pi,
            "astra" => Self::Astra,
            "sol" => Self::Sol,
            "luna" => Self::Luna,
            "opus" => Self::Opus,
            "fable" => Self::Fable,
            "grok" => Self::Grok,
            "composer" => Self::Composer,
            _ => return die(format!("unknown preset: {text}")),
        })
    }
}

impl fmt::Display for Preset {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Pi => "pi",
            Self::Astra => "astra",
            Self::Sol => "sol",
            Self::Luna => "luna",
            Self::Opus => "opus",
            Self::Fable => "fable",
            Self::Grok => "grok",
            Self::Composer => "composer",
        })
    }
}

/// How an agent process is launched inside its pane.
#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Launch {
    Pi,
    Claude {
        model: &'static str,
        effort: &'static str,
    },
    Codex {
        model: String,
        effort: &'static str,
    },
    Cursor {
        model: String,
    },
}

impl Launch {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Pi => "pi",
            Self::Claude { .. } => "claude",
            Self::Codex { .. } => "codex",
            Self::Cursor { .. } => "cursor",
        }
    }

    pub fn model(&self) -> &str {
        match self {
            Self::Pi => "",
            Self::Claude { model, .. } => model,
            Self::Codex { model, .. } | Self::Cursor { model } => model,
        }
    }

    pub fn effort(&self) -> Option<&'static str> {
        match self {
            Self::Claude { effort, .. } | Self::Codex { effort, .. } => Some(effort),
            Self::Pi | Self::Cursor { .. } => None,
        }
    }

    pub fn agent_args(&self) -> Vec<String> {
        let model = |model: &str| ["--model".to_string(), model.to_string()];
        match self {
            Self::Pi => vec!["--no-session".to_string()],
            Self::Claude {
                model: name,
                effort,
            } => {
                let mut args = model(name).to_vec();
                args.extend(["--effort".to_string(), (*effort).to_string()]);
                args
            }
            Self::Codex {
                model: name,
                effort,
            } => {
                let mut args = model(name).to_vec();
                args.extend([
                    "--config".to_string(),
                    format!("model_reasoning_effort=\"{effort}\""),
                ]);
                args
            }
            Self::Cursor { model: name } => model(name).to_vec(),
        }
    }
}

/// Model catalogs of the external CLIs, each loaded at most once per run.
#[derive(Default)]
pub struct Catalogs {
    codex: Option<String>,
    cursor: Option<String>,
}

fn load_catalog(program: &str, args: &[&str], failure: &str) -> Result<String> {
    capture_stdout(program, args).or_else(|_| die(failure))
}

fn is_cursor_grok(name: &str) -> bool {
    name.strip_prefix("cursor-grok-")
        .and_then(|rest| rest.strip_suffix("-high-fast"))
        .is_some_and(version::is_dotted_number)
}

fn is_cursor_composer(name: &str) -> bool {
    name.strip_prefix("composer-")
        .is_some_and(version::is_dotted_number)
}

impl Catalogs {
    fn latest_codex_model(&mut self, family: &str) -> Result<String> {
        if !is_on_path("codex") {
            return die(format!("codex is required for the {family} preset"));
        }
        if self.codex.is_none() {
            self.codex = Some(load_catalog(
                "codex",
                &["debug", "models"],
                "failed to load the Codex model catalog",
            )?);
        }
        let catalog = json::parse(self.codex.as_deref().unwrap_or_default(), "codex")?;
        let models = catalog
            .get("models")
            .and_then(Value::as_array)
            .ok_or(Error::Exit(JQ_RUNTIME_ERROR))?;
        let suffix = format!("-{family}");
        version::latest(
            models
                .iter()
                .filter_map(|model| model.get("slug").and_then(Value::as_str))
                .filter(|slug| slug.ends_with(&suffix)),
        )
        .map(str::to_string)
        .ok_or_else(|| Error::Message(format!("no current Codex {family} model is available")))
    }

    fn latest_cursor_model(&mut self, family: &str, matches: fn(&str) -> bool) -> Result<String> {
        if !is_on_path("cursor-agent") {
            return die(format!("cursor-agent is required for the {family} preset"));
        }
        if self.cursor.is_none() {
            self.cursor = Some(load_catalog(
                "cursor-agent",
                &["--list-models"],
                "failed to load the Cursor model catalog",
            )?);
        }
        let catalog = self.cursor.as_deref().unwrap_or_default();
        version::latest(
            catalog
                .lines()
                .filter_map(|line| line.split_whitespace().next())
                .filter(|name| matches(name)),
        )
        .map(str::to_string)
        .ok_or_else(|| Error::Message(format!("no current Cursor {family} model is available")))
    }

    pub fn resolve(&mut self, preset: Preset) -> Result<Launch> {
        Ok(match preset {
            Preset::Pi => Launch::Pi,
            Preset::Astra => Launch::Codex {
                model: self.latest_codex_model("astra")?,
                effort: "low",
            },
            Preset::Sol => Launch::Codex {
                model: self.latest_codex_model("sol")?,
                effort: "medium",
            },
            Preset::Luna => Launch::Codex {
                model: self.latest_codex_model("luna")?,
                effort: "xhigh",
            },
            Preset::Opus => Launch::Claude {
                model: "opus",
                effort: "medium",
            },
            Preset::Fable => Launch::Claude {
                model: "fable",
                effort: "low",
            },
            Preset::Grok => Launch::Cursor {
                model: self.latest_cursor_model("grok", is_cursor_grok)?,
            },
            Preset::Composer => Launch::Cursor {
                model: self.latest_cursor_model("composer", is_cursor_composer)?,
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn presets_round_trip() {
        for name in [
            "pi", "astra", "sol", "luna", "opus", "fable", "grok", "composer",
        ] {
            assert_eq!(name.parse::<Preset>().unwrap().to_string(), name);
        }
        assert_eq!(
            "nope".parse::<Preset>().unwrap_err().to_string(),
            "unknown preset: nope"
        );
    }

    #[test]
    fn cursor_model_names() {
        assert!(is_cursor_grok("cursor-grok-4.1-high-fast"));
        assert!(!is_cursor_grok("cursor-grok-4.1-high"));
        assert!(is_cursor_composer("composer-2.5"));
        assert!(!is_cursor_composer("composer-2.5-fast"));
    }

    #[test]
    fn launch_arguments() {
        assert_eq!(Launch::Pi.agent_args(), ["--no-session"]);
        assert_eq!(
            Launch::Codex {
                model: "gpt-sol".into(),
                effort: "low"
            }
            .agent_args(),
            [
                "--model",
                "gpt-sol",
                "--config",
                "model_reasoning_effort=\"low\""
            ]
        );
        assert_eq!(
            Launch::Claude {
                model: "opus",
                effort: "medium"
            }
            .agent_args(),
            ["--model", "opus", "--effort", "medium"]
        );
        assert_eq!(
            Launch::Cursor {
                model: "composer-2".into()
            }
            .agent_args(),
            ["--model", "composer-2"]
        );
    }
}
