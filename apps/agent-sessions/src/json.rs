use std::sync::LazyLock;

use serde_json::{Map, Value};

use crate::js;
use crate::model::JsonObject;

static EMPTY: LazyLock<JsonObject> = LazyLock::new(Map::new);

pub fn object_or_empty(value: Option<&Value>) -> &JsonObject {
    value.and_then(Value::as_object).unwrap_or(&EMPTY)
}

pub trait Fields {
    fn str(&self, key: &str) -> Option<&str>;
    fn object(&self, key: &str) -> &JsonObject;
    fn array(&self, key: &str) -> &[Value];
    fn is_true(&self, key: &str) -> bool;
    fn time(&self, key: &str) -> Option<f64>;

    fn non_empty_str(&self, key: &str) -> Option<&str> {
        self.str(key).filter(|text| !text.is_empty())
    }
}

impl Fields for JsonObject {
    fn str(&self, key: &str) -> Option<&str> {
        self.get(key).and_then(Value::as_str)
    }

    fn object(&self, key: &str) -> &JsonObject {
        object_or_empty(self.get(key))
    }

    fn array(&self, key: &str) -> &[Value] {
        self.get(key)
            .and_then(Value::as_array)
            .map_or(&[], Vec::as_slice)
    }

    fn is_true(&self, key: &str) -> bool {
        self.get(key) == Some(&Value::Bool(true))
    }

    fn time(&self, key: &str) -> Option<f64> {
        match self.get(key)? {
            Value::Number(number) => number.as_f64(),
            Value::String(text) => js::date_parse(text),
            _ => None,
        }
    }
}

pub fn parse_object_line(line: &str) -> Option<JsonObject> {
    if js::trim(line).is_empty() {
        return None;
    }
    match serde_json::from_str(line) {
        Ok(Value::Object(map)) => Some(map),
        _ => None,
    }
}

pub fn objects(values: &[Value]) -> impl Iterator<Item = &JsonObject> {
    values.iter().map(|value| object_or_empty(Some(value)))
}

pub fn text_content(content: Option<&Value>, separator: &str) -> String {
    match content {
        Some(Value::String(text)) => text.clone(),
        _ => objects(content.and_then(Value::as_array).map_or(&[], Vec::as_slice))
            .filter_map(|block| block.non_empty_str("text"))
            .collect::<Vec<_>>()
            .join(separator),
    }
}
