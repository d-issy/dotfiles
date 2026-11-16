use crate::error::{Error, Result};
use dot::json::Value;

pub fn parse(text: &str, origin: &str) -> Result<Value> {
    dot::json::from_str(text).map_err(|source| Error::InvalidJson {
        origin: origin.to_string(),
        source,
    })
}

pub fn pretty(value: &Value) -> String {
    dot::json::to_string_pretty(value).unwrap_or_default()
}

pub use dot::json::raw;

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
    use dot::json::json;

    #[test]
    fn jq_style_rendering() {
        assert_eq!(raw(&json!("x")), "x");
        assert_eq!(raw(&Value::Null), "null");
        assert_eq!(raw_or(None, "d"), "d");
        assert_eq!(raw_or(Some(&json!(false)), "d"), "d");
        assert_eq!(raw_or(Some(&json!("idle")), "d"), "idle");
    }
}
