use crate::error::{Error, Result};
use serde_json::Value;

pub fn parse(text: &str, origin: &str) -> Result<Value> {
    serde_json::from_str(text).map_err(|source| Error::InvalidJson {
        origin: origin.to_string(),
        source,
    })
}

pub fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_default()
}

/// Renders a value the way `jq -r` does.
pub fn raw(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}

/// The `jq -r '.path // default'` idiom: null, false and missing all fall back to the default.
pub fn raw_or(value: Option<&Value>, default: &str) -> String {
    match value {
        None | Some(Value::Null | Value::Bool(false)) => default.to_string(),
        Some(other) => raw(other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn jq_style_rendering() {
        assert_eq!(raw(&json!("x")), "x");
        assert_eq!(raw(&Value::Null), "null");
        assert_eq!(raw_or(None, "d"), "d");
        assert_eq!(raw_or(Some(&json!(false)), "d"), "d");
        assert_eq!(raw_or(Some(&json!("idle")), "d"), "idle");
    }
}
