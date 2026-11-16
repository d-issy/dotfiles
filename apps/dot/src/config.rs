use std::collections::{BTreeMap, HashMap};

use crate::json::{Decode, Error, Map, Value};

/// Reads typed configuration fields, applying defaults only to absent fields.
pub struct Object(Map);

impl Object {
    pub fn new(value: Value) -> Result<Self, Error> {
        match value {
            Value::Object(map) => Ok(Self(map)),
            _ => Err(Error::new("expected an object")),
        }
    }

    pub fn required<T: Decode>(&mut self, key: &str) -> Result<T, Error> {
        self.check_duplicate(key)?;
        let value = self
            .0
            .remove(key)
            .ok_or_else(|| Error::new(format!("missing field `{key}`")))?;
        Self::decode_field(key, value)
    }

    pub fn field_or<T: Decode>(&mut self, key: &str, default: T) -> Result<T, Error> {
        self.check_duplicate(key)?;
        match self.0.remove(key) {
            Some(value) => Self::decode_field(key, value),
            None => Ok(default),
        }
    }

    fn decode_field<T: Decode>(key: &str, value: Value) -> Result<T, Error> {
        T::decode(value).map_err(|error| Error::new(format!("field `{key}`: {error}")))
    }

    fn check_duplicate(&self, key: &str) -> Result<(), Error> {
        if self.0.has_duplicate_key(key) {
            Err(Error::new(format!("duplicate field `{key}`")))
        } else {
            Ok(())
        }
    }
}

impl Decode for String {
    fn decode(value: Value) -> Result<Self, Error> {
        match value {
            Value::String(text) => Ok(text),
            _ => Err(Error::new("expected a string")),
        }
    }
}

impl Decode for bool {
    fn decode(value: Value) -> Result<Self, Error> {
        match value {
            Value::Bool(value) => Ok(value),
            _ => Err(Error::new("expected a boolean")),
        }
    }
}

impl Decode for usize {
    fn decode(value: Value) -> Result<Self, Error> {
        value
            .as_u64()
            .and_then(|number| Self::try_from(number).ok())
            .ok_or_else(|| Error::new("expected a nonnegative integer"))
    }
}

impl<T: Decode> Decode for Vec<T> {
    fn decode(value: Value) -> Result<Self, Error> {
        match value {
            Value::Array(values) => values.into_iter().map(T::decode).collect(),
            _ => Err(Error::new("expected an array")),
        }
    }
}

impl<T: Decode> Decode for Option<T> {
    fn decode(value: Value) -> Result<Self, Error> {
        match value {
            Value::Null => Ok(None),
            value => T::decode(value).map(Some),
        }
    }
}

impl<T: Decode> Decode for HashMap<String, T> {
    fn decode(value: Value) -> Result<Self, Error> {
        match value {
            Value::Object(map) => map
                .into_iter()
                .map(|(key, value)| T::decode(value).map(|value| (key, value)))
                .collect(),
            _ => Err(Error::new("expected an object")),
        }
    }
}

impl<T: Decode> Decode for BTreeMap<String, T> {
    fn decode(value: Value) -> Result<Self, Error> {
        match value {
            Value::Object(map) => map
                .into_iter()
                .map(|(key, value)| T::decode(value).map(|value| (key, value)))
                .collect(),
            _ => Err(Error::new("expected an object")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::json;

    #[test]
    fn distinguishes_absent_fields_from_null() {
        let mut object =
            Object::new(json::from_str(r#"{"optional":null,"required":null}"#).unwrap()).unwrap();
        assert_eq!(
            object.field_or("missing", String::from("default")).unwrap(),
            "default"
        );
        assert_eq!(
            object
                .field_or("optional", Some(String::from("default")))
                .unwrap(),
            None
        );
        assert!(
            object
                .field_or("required", String::from("default"))
                .is_err()
        );
        assert!(
            object
                .required::<String>("missing")
                .unwrap_err()
                .to_string()
                .contains("missing field")
        );
    }

    #[test]
    fn decodes_only_matching_json_types() {
        assert!(json::from_str::<bool>("false").is_ok());
        assert!(json::from_str::<bool>("0").is_err());
        assert!(json::from_str::<String>("false").is_err());
        assert_eq!(json::from_str::<usize>("0").unwrap(), 0);
        for invalid in ["-1", "1.5", "1.0", "null", "\"1\""] {
            assert!(json::from_str::<usize>(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn validates_collection_elements_and_optional_values() {
        assert_eq!(
            json::from_str::<Vec<String>>(r#"["a","b"]"#).unwrap(),
            ["a", "b"]
        );
        assert!(json::from_str::<Vec<String>>(r#"["a",false]"#).is_err());
        assert!(json::from_str::<Vec<String>>("null").is_err());
        assert_eq!(json::from_str::<Option<String>>("null").unwrap(), None);
        assert!(json::from_str::<Option<String>>("false").is_err());
        assert_eq!(
            json::from_str::<BTreeMap<String, bool>>(r#"{"b":true,"a":false}"#)
                .unwrap()
                .keys()
                .map(String::as_str)
                .collect::<Vec<_>>(),
            ["a", "b"]
        );
        assert!(json::from_str::<HashMap<String, bool>>(r#"{"b":null}"#).is_err());
    }
}
