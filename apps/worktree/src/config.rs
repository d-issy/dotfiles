use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
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
        serde_json::from_str(&text).map_err(|err| format!("{path}: {err}"))
    }
}
