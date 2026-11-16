use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use serde_json::Value;

use crate::model::JsonObject;

pub struct TempDir(PathBuf);

impl TempDir {
    pub fn new() -> Self {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let path = std::env::temp_dir().join(format!(
            "agent-sessions-{}-{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }

    pub fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

pub fn append(path: &Path, bytes: &[u8]) {
    let mut file = fs::OpenOptions::new().append(true).open(path).unwrap();
    file.write_all(bytes).unwrap();
}

pub fn object(value: Value) -> JsonObject {
    match value {
        Value::Object(map) => map,
        other => panic!("not an object: {other}"),
    }
}

pub fn objects(values: &[Value]) -> Vec<JsonObject> {
    values.iter().cloned().map(object).collect()
}

pub fn jsonl(records: &[JsonObject]) -> String {
    records
        .iter()
        .map(|record| Value::Object(record.clone()).to_string() + "\n")
        .collect()
}
