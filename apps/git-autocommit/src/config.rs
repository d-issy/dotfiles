use crate::error::{Error, Result as AppResult};
use dot::config::Object;
use dot::json::{self, Decode, Value};
use std::fs;

pub struct Config {
    pub pi_args: Vec<String>,
    pub diff_pathspecs: Vec<String>,
}

impl Config {
    /// Splits the leading `--config <file>` pair off the arguments.
    pub fn from_args(mut args: impl Iterator<Item = String>) -> AppResult<(Self, Vec<String>)> {
        let (Some("--config"), Some(path)) = (args.next().as_deref(), args.next()) else {
            return Err(Error::Config(
                "git-auto-commit: missing --config <file>".into(),
            ));
        };
        let fail =
            |e: &dyn std::fmt::Display| Error::Config(format!("git-auto-commit: {path}: {e}"));
        let text = fs::read_to_string(&path).map_err(|e| fail(&e))?;
        let config = json::from_str(&text).map_err(|e| fail(&e))?;
        Ok((config, args.collect()))
    }
}

impl Decode for Config {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        Ok(Self {
            pi_args: object.required("pi_args")?,
            diff_pathspecs: object.required("diff_pathspecs")?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_both_snake_case_configuration_fields() {
        let config: Config =
            json::from_str(r#"{"pi_args":[],"diff_pathspecs":[":!secret"],"unknown":true}"#)
                .unwrap();
        assert!(config.pi_args.is_empty());
        assert_eq!(config.diff_pathspecs, [":!secret"]);
        for invalid in [
            r#"{}"#,
            r#"{"piArgs":[],"diffPathspecs":[]}"#,
            r#"{"pi_args":null,"diff_pathspecs":[]}"#,
            r#"{"pi_args":[],"diff_pathspecs":[false]}"#,
        ] {
            assert!(json::from_str::<Config>(invalid).is_err(), "{invalid}");
        }
    }
}
