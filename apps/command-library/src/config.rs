use crate::error::{Error, Result};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct Replacement {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Variable {
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

pub fn load_config(path: &str) -> Result<Config> {
    let failure = |error: &dyn std::fmt::Display| Error::failure(format!("{path}: {error}"));
    let text = std::fs::read_to_string(Path::new(path)).map_err(|error| failure(&error))?;
    serde_json::from_str(&text).map_err(|error| failure(&error))
}
