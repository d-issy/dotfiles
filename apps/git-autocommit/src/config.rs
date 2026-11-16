use crate::error::{Error, Result};
use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
pub struct Config {
    pub pi_args: Vec<String>,
    pub diff_pathspecs: Vec<String>,
}

impl Config {
    /// Splits the leading `--config <file>` pair off the arguments.
    pub fn from_args(mut args: impl Iterator<Item = String>) -> Result<(Self, Vec<String>)> {
        let (Some("--config"), Some(path)) = (args.next().as_deref(), args.next()) else {
            return Err(Error::Config(
                "git-auto-commit: missing --config <file>".into(),
            ));
        };
        let fail =
            |e: &dyn std::fmt::Display| Error::Config(format!("git-auto-commit: {path}: {e}"));
        let text = fs::read_to_string(&path).map_err(|e| fail(&e))?;
        let config = serde_json::from_str(&text).map_err(|e| fail(&e))?;
        Ok((config, args.collect()))
    }
}
