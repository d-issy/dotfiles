use dot::config::Object;
use dot::json::{self, Decode, Value};

#[derive(Debug, Clone)]
pub struct Config {
    pub model: Option<String>,
    pub thinking: Option<String>,
    pub diff_pathspecs: Vec<String>,
    pub fuzzy_finder: String,
    pub git: String,
    pub gh: String,
    pub tmux: String,
    pub patch: String,
    pub petname: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            model: None,
            thinking: None,
            diff_pathspecs: Vec::new(),
            fuzzy_finder: "fzf".into(),
            git: "git".into(),
            gh: "gh".into(),
            tmux: "tmux".into(),
            patch: "patch".into(),
            petname: "petname".into(),
        }
    }
}

impl Config {
    pub fn load(path: &str) -> Result<Self, String> {
        let text = std::fs::read_to_string(path).map_err(|err| format!("{path}: {err}"))?;
        json::from_str(&text).map_err(|err| format!("{path}: {err}"))
    }
}

impl Decode for Config {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            model: object.field_or("model", defaults.model)?,
            thinking: object.field_or("thinking", defaults.thinking)?,
            diff_pathspecs: object.field_or("diffPathspecs", defaults.diff_pathspecs)?,
            fuzzy_finder: object.field_or("fuzzyFinder", defaults.fuzzy_finder)?,
            git: object.field_or("git", defaults.git)?,
            gh: object.field_or("gh", defaults.gh)?,
            tmux: object.field_or("tmux", defaults.tmux)?,
            patch: object.field_or("patch", defaults.patch)?,
            petname: object.field_or("petname", defaults.petname)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_command_defaults_and_camel_case_overrides() {
        let config: Config =
            json::from_str(r#"{"model":null,"fuzzyFinder":"sk","diffPathspecs":[":!secret"]}"#)
                .unwrap();
        assert_eq!(config.model, None);
        assert_eq!(config.fuzzy_finder, "sk");
        assert_eq!(config.git, "git");
        assert_eq!(config.diff_pathspecs, [":!secret"]);
        assert_eq!(json::from_str::<Config>("{}").unwrap().fuzzy_finder, "fzf");
        for invalid in [
            "null",
            r#"{"git":null}"#,
            r#"{"thinking":false}"#,
            r#"{"diffPathspecs":null}"#,
        ] {
            assert!(json::from_str::<Config>(invalid).is_err(), "{invalid}");
        }
    }
}
