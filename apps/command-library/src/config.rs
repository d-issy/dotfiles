use crate::error::{Error, Result as AppResult};
use dot::config::Object;
use dot::json::{self, Decode, Value};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Replacement {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone)]
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

#[derive(Debug, Clone)]
pub struct Entry {
    pub description: String,
    pub alias: Option<String>,
    pub command: String,
}

#[derive(Debug, Clone, Default)]
pub struct When {
    pub paths: Vec<String>,
    pub files: Vec<String>,
    pub search_parents: bool,
    pub commands: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct Section {
    pub tags: Vec<String>,
    pub variables: HashMap<String, Variable>,
    pub entries: Vec<Entry>,
    pub when: Option<When>,
}

#[derive(Debug, Clone, Default)]
pub struct FzfConfig {
    pub command: String,
    pub options: Vec<String>,
    pub variable_options: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct Config {
    pub fzf: FzfConfig,
    pub sections: Vec<Section>,
}

pub fn load_config(path: &str) -> AppResult<Config> {
    let failure = |error: &dyn std::fmt::Display| Error::failure(format!("{path}: {error}"));
    let text = std::fs::read_to_string(Path::new(path)).map_err(|error| failure(&error))?;
    json::from_str(&text).map_err(|error| failure(&error))
}

impl Decode for Replacement {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        Ok(Self {
            from: object.required("from")?,
            to: object.required("to")?,
        })
    }
}

impl Decode for Variable {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            command: object.field_or("command", defaults.command)?,
            values: object.field_or("values", defaults.values)?,
            json: object.field_or("json", defaults.json)?,
            separator: object.field_or("separator", defaults.separator)?,
            r#match: object.field_or("match", defaults.r#match)?,
            replace: object.field_or("replace", defaults.replace)?,
            unique: object.field_or("unique", defaults.unique)?,
            sort: object.field_or("sort", defaults.sort)?,
            column: object.field_or("column", defaults.column)?,
            headers: object.field_or("headers", defaults.headers)?,
            delimiter: object.field_or("delimiter", defaults.delimiter)?,
            multi: object.field_or("multi", defaults.multi)?,
            select_one: object.field_or("selectOne", defaults.select_one)?,
        })
    }
}

impl Decode for Entry {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        Ok(Self {
            description: object.required("description")?,
            alias: object.field_or("alias", None)?,
            command: object.required("command")?,
        })
    }
}

impl Decode for When {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            paths: object.field_or("paths", defaults.paths)?,
            files: object.field_or("files", defaults.files)?,
            search_parents: object.field_or("searchParents", defaults.search_parents)?,
            commands: object.field_or("commands", defaults.commands)?,
        })
    }
}

impl Decode for Section {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            tags: object.field_or("tags", defaults.tags)?,
            variables: object.field_or("variables", defaults.variables)?,
            entries: object.field_or("entries", defaults.entries)?,
            when: object.field_or("when", defaults.when)?,
        })
    }
}

impl Decode for FzfConfig {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            command: object.field_or("command", defaults.command)?,
            options: object.field_or("options", defaults.options)?,
            variable_options: object.field_or("variableOptions", defaults.variable_options)?,
        })
    }
}

impl Decode for Config {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        let defaults = Self::default();
        Ok(Self {
            fzf: object.field_or("fzf", defaults.fzf)?,
            sections: object.field_or("sections", defaults.sections)?,
        })
    }
}

#[cfg(test)]
mod decode_tests {
    use super::*;

    #[test]
    fn defaults_apply_only_to_missing_fields() {
        let variable: Variable = json::from_str(r#"{"command":null,"unknown":true}"#).unwrap();
        assert!(variable.select_one);
        assert!(variable.command.is_none());
        assert!(variable.values.is_empty());
        let variable: Variable = json::from_str(r#"{"selectOne":false,"headers":2}"#).unwrap();
        assert!(!variable.select_one);
        assert_eq!(variable.headers, 2);
        for invalid in [
            r#"{"values":null}"#,
            r#"{"headers":-1}"#,
            r#"{"unique":"yes"}"#,
        ] {
            assert!(json::from_str::<Variable>(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn validates_required_fields_and_optional_alias() {
        let entry: Entry = json::from_str(r#"{"description":"Run","command":"run"}"#).unwrap();
        assert_eq!(entry.alias, None);
        assert!(json::from_str::<Entry>(r#"{"command":"run"}"#).is_err());
        assert!(json::from_str::<Replacement>(r#"{"from":"a","to":null}"#).is_err());
        assert!(
            json::from_str::<Config>(r#"{"sections":[{"entries":[{"description":"Run"}]}]}"#)
                .is_err()
        );
    }

    #[test]
    fn rejects_duplicate_known_fields_and_ignores_unknown_fields() {
        assert!(json::from_str::<Variable>(r#"{"selectOne":false,"selectOne":true}"#).is_err());
        assert!(json::from_str::<Variable>(r#"{"unknown":1,"unknown":2}"#).is_ok());
    }
}
