use std::fmt;

mod macros;
mod parse;

#[cfg(test)]
mod tests;

/// A JSON value owned by dot, independent of the parser used internally.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub enum Value {
    #[default]
    Null,
    Bool(bool),
    Number(Number),
    String(String),
    Array(Vec<Value>),
    Object(Map),
}

impl Value {
    pub fn get(&self, key: &str) -> Option<&Self> {
        self.as_object()?.get(key)
    }

    pub fn get_mut(&mut self, key: &str) -> Option<&mut Self> {
        self.as_object_mut()?.get_mut(key)
    }

    /// Looks up an RFC 6901 pointer through object fields and array indices.
    pub fn pointer(&self, pointer: &str) -> Option<&Self> {
        if pointer.is_empty() {
            return Some(self);
        }
        pointer
            .strip_prefix('/')?
            .split('/')
            .map(|token| token.replace("~1", "/").replace("~0", "~"))
            .try_fold(self, |target, token| match target {
                Self::Object(map) => map.get(&token),
                Self::Array(values) => {
                    if token.starts_with('+') || (token.starts_with('0') && token.len() != 1) {
                        None
                    } else {
                        token
                            .parse::<usize>()
                            .ok()
                            .and_then(|index| values.get(index))
                    }
                }
                _ => None,
            })
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::String(text) => Some(text),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&Vec<Self>> {
        match self {
            Self::Array(values) => Some(values),
            _ => None,
        }
    }

    pub fn as_array_mut(&mut self) -> Option<&mut Vec<Self>> {
        match self {
            Self::Array(values) => Some(values),
            _ => None,
        }
    }

    pub fn as_object(&self) -> Option<&Map> {
        match self {
            Self::Object(map) => Some(map),
            _ => None,
        }
    }

    pub fn as_object_mut(&mut self) -> Option<&mut Map> {
        match self {
            Self::Object(map) => Some(map),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Self::Number(number) => number.as_f64(),
            _ => None,
        }
    }

    pub fn as_i64(&self) -> Option<i64> {
        match self {
            Self::Number(number) => number.as_i64(),
            _ => None,
        }
    }

    pub fn as_u64(&self) -> Option<u64> {
        match self {
            Self::Number(number) => number.as_u64(),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Self::Bool(value) => Some(*value),
            _ => None,
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }
}

impl fmt::Display for Value {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        to_backend(self).fmt(formatter)
    }
}

/// A JSON number that retains signed and unsigned integer precision.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Number(serde_json::Number);

impl Number {
    pub fn as_f64(&self) -> Option<f64> {
        self.0.as_f64()
    }

    pub fn as_i64(&self) -> Option<i64> {
        self.0.as_i64()
    }

    pub fn as_u64(&self) -> Option<u64> {
        self.0.as_u64()
    }
}

impl fmt::Display for Number {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

/// An object whose iteration order follows insertion order.
#[derive(Clone, Debug, Default)]
pub struct Map {
    entries: Vec<(String, Value)>,
    duplicate_keys: Vec<String>,
}

impl Map {
    pub const fn new() -> Self {
        Self {
            entries: Vec::new(),
            duplicate_keys: Vec::new(),
        }
    }

    pub fn get(&self, key: &str) -> Option<&Value> {
        self.entries
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value)
    }

    pub fn get_mut(&mut self, key: &str) -> Option<&mut Value> {
        self.entries
            .iter_mut()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value)
    }

    pub fn insert(&mut self, key: String, value: Value) -> Option<Value> {
        if let Some((_, previous)) = self.entries.iter_mut().find(|(name, _)| name == &key) {
            return Some(std::mem::replace(previous, value));
        }
        self.entries.push((key, value));
        None
    }

    /// Removes a field, moving the final field into its position.
    pub fn remove(&mut self, key: &str) -> Option<Value> {
        let index = self.entries.iter().position(|(name, _)| name == key)?;
        Some(self.entries.swap_remove(index).1)
    }

    /// Reports repeated fields in the parsed input without changing last-wins values.
    pub fn has_duplicate_key(&self, key: &str) -> bool {
        self.duplicate_keys.iter().any(|name| name == key)
    }

    pub fn iter(&self) -> Iter<'_> {
        Iter(self.entries.iter())
    }

    pub fn keys(&self) -> impl Iterator<Item = &String> {
        self.entries.iter().map(|(key, _)| key)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

impl PartialEq for Map {
    fn eq(&self, other: &Self) -> bool {
        self.len() == other.len()
            && self
                .iter()
                .all(|(key, value)| other.get(key) == Some(value))
    }
}

impl Eq for Map {}

pub struct Iter<'a>(std::slice::Iter<'a, (String, Value)>);

impl<'a> Iterator for Iter<'a> {
    type Item = (&'a String, &'a Value);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|(key, value)| (key, value))
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.0.size_hint()
    }
}

impl DoubleEndedIterator for Iter<'_> {
    fn next_back(&mut self) -> Option<Self::Item> {
        self.0.next_back().map(|(key, value)| (key, value))
    }
}

impl ExactSizeIterator for Iter<'_> {}
impl std::iter::FusedIterator for Iter<'_> {}

impl IntoIterator for Map {
    type Item = (String, Value);
    type IntoIter = std::vec::IntoIter<Self::Item>;

    fn into_iter(self) -> Self::IntoIter {
        self.entries.into_iter()
    }
}

impl<'a> IntoIterator for &'a Map {
    type Item = (&'a String, &'a Value);
    type IntoIter = Iter<'a>;

    fn into_iter(self) -> Self::IntoIter {
        self.iter()
    }
}

impl FromIterator<(String, Value)> for Map {
    fn from_iter<T: IntoIterator<Item = (String, Value)>>(entries: T) -> Self {
        let mut map = Self::new();
        for (key, value) in entries {
            map.insert(key, value);
        }
        map
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Error(String);

impl Error {
    pub fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

impl std::error::Error for Error {}

/// Decodes a dot JSON value into an application type.
pub trait Decode: Sized {
    fn decode(value: Value) -> Result<Self, Error>;
}

impl Decode for Value {
    fn decode(value: Value) -> Result<Self, Error> {
        Ok(value)
    }
}

pub fn from_str<T: Decode>(text: &str) -> Result<T, Error> {
    let parsed = serde_json::from_str::<parse::ParsedValue>(text)
        .map_err(|error| Error::new(error.to_string()))?;
    T::decode(parsed.0)
}

pub fn to_string(value: &Value) -> Result<String, Error> {
    serde_json::to_string(&to_backend(value)).map_err(|error| Error::new(error.to_string()))
}

pub fn to_string_pretty(value: &Value) -> Result<String, Error> {
    serde_json::to_string_pretty(&to_backend(value)).map_err(|error| Error::new(error.to_string()))
}

/// Renders objects with recursively sorted keys, leaving their stored order intact.
pub fn to_string_pretty_sorted(value: &Value) -> Result<String, Error> {
    let mut value = to_backend(value);
    value.sort_all_objects();
    serde_json::to_string_pretty(&value).map_err(|error| Error::new(error.to_string()))
}

/// Reads consecutive JSON documents, stopping after the first parse failure.
pub fn stream(text: &str) -> impl Iterator<Item = Result<Value, Error>> + '_ {
    serde_json::Deserializer::from_str(text)
        .into_iter::<parse::ParsedValue>()
        .map(|result| {
            result
                .map(|parsed| parsed.0)
                .map_err(|error| Error::new(error.to_string()))
        })
}

/// Returns strings directly and serializes other values as compact JSON.
pub fn raw(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}

/// Returns strings directly and renders all object keys in sorted order.
pub fn raw_sorted(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => {
            let mut value = to_backend(other);
            value.sort_all_objects();
            value.to_string()
        }
    }
}

fn to_backend(value: &Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Bool(value) => serde_json::Value::Bool(*value),
        Value::Number(value) => serde_json::Value::Number(value.0.clone()),
        Value::String(value) => serde_json::Value::String(value.clone()),
        Value::Array(values) => serde_json::Value::Array(values.iter().map(to_backend).collect()),
        Value::Object(map) => serde_json::Value::Object(
            map.iter()
                .map(|(key, value)| (key.clone(), to_backend(value)))
                .collect(),
        ),
    }
}

impl From<bool> for Value {
    fn from(value: bool) -> Self {
        Self::Bool(value)
    }
}

impl From<String> for Value {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}

impl From<&str> for Value {
    fn from(value: &str) -> Self {
        Self::String(value.to_string())
    }
}

impl From<Number> for Value {
    fn from(value: Number) -> Self {
        Self::Number(value)
    }
}

impl From<Map> for Value {
    fn from(value: Map) -> Self {
        Self::Object(value)
    }
}

impl<T: Into<Value>> From<Vec<T>> for Value {
    fn from(values: Vec<T>) -> Self {
        Self::Array(values.into_iter().map(Into::into).collect())
    }
}

impl<T: Into<Value>> From<Option<T>> for Value {
    fn from(value: Option<T>) -> Self {
        value.map(Into::into).unwrap_or_default()
    }
}

impl<T: Clone + Into<Value>> From<&T> for Value {
    fn from(value: &T) -> Self {
        value.clone().into()
    }
}

macro_rules! integer_conversions {
    ($($integer:ty),* $(,)?) => {
        $(impl From<$integer> for Value {
            fn from(value: $integer) -> Self {
                Self::Number(Number(value.into()))
            }
        })*
    };
}

integer_conversions!(i8, i16, i32, i64, isize, u8, u16, u32, u64, usize);

impl From<f64> for Value {
    fn from(value: f64) -> Self {
        serde_json::Number::from_f64(value)
            .map(|number| Self::Number(Number(number)))
            .unwrap_or_default()
    }
}

impl From<f32> for Value {
    fn from(value: f32) -> Self {
        Self::from(f64::from(value))
    }
}

pub use crate::__dot_json as json;
