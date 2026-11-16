use dot::config::Object;
use dot::json::{self, Decode, Value};

pub struct Config {
    pub herdr: String,
    pub ghq: String,
    pub fuzzy_finder: String,
    pub include_parents: bool,
    pub attach: bool,
}

impl Decode for Config {
    fn decode(value: Value) -> Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        Ok(Self {
            herdr: object.required("herdr")?,
            ghq: object.required("ghq")?,
            fuzzy_finder: object.required("fuzzyFinder")?,
            include_parents: object.field_or("includeParentDirectories", false)?,
            attach: object.field_or("attach", false)?,
        })
    }
}
