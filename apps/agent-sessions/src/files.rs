use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::json::parse_json_line;
use crate::types::{JsonObject, SessionStatus};

/// Modification time in milliseconds since the epoch, like `mtimeMs`.
pub fn mtime(path: &Path) -> Option<f64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    Some(match modified.duration_since(UNIX_EPOCH) {
        Ok(after) => after.as_secs_f64() * 1000.0,
        Err(before) => -before.duration().as_secs_f64() * 1000.0,
    })
}

/// Directory entries sorted by name, as Node's `readdirSync` returns them.
pub fn list_dir(path: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(path) else {
        return Vec::new();
    };
    let mut names: Vec<_> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.file_name())
        .collect();
    names.sort_by(|a, b| a.as_encoded_bytes().cmp(b.as_encoded_bytes()));
    names
        .into_iter()
        .map(|name| name.to_string_lossy().into_owned())
        .collect()
}

fn read_range(path: &Path, start: u64, length: u64) -> io::Result<Vec<u8>> {
    let mut file = File::open(path)?;
    file.seek(SeekFrom::Start(start))?;
    let mut buffer = Vec::new();
    file.take(length).read_to_end(&mut buffer)?;
    Ok(buffer)
}

/// Parse the first JSONL record, reading at most 4 MiB.
pub fn read_first_record(path: &Path) -> Option<JsonObject> {
    let buffer = read_range(path, 0, 4 * 1024 * 1024).ok()?;
    let end = buffer
        .iter()
        .position(|&byte| byte == b'\n')
        .unwrap_or(buffer.len());
    parse_json_line(&String::from_utf8_lossy(&buffer[..end]))
}

fn split_records(text: &str) -> Vec<JsonObject> {
    text.split('\n').filter_map(parse_json_line).collect()
}

/// Incrementally follows a JSONL file that is appended to.
pub struct JsonlTail {
    path: PathBuf,
    initial_bytes: u64,
    offset: Option<u64>,
    partial: Vec<u8>,
}

impl JsonlTail {
    pub fn new(path: impl Into<PathBuf>, initial_bytes: u64) -> Self {
        Self {
            path: path.into(),
            initial_bytes,
            offset: None,
            partial: Vec::new(),
        }
    }

    pub fn poll(&mut self) -> Vec<JsonObject> {
        let Ok(metadata) = fs::metadata(&self.path) else {
            return Vec::new();
        };
        let size = metadata.len();
        let offset = match self.offset {
            Some(offset) if size >= offset => offset,
            _ => {
                let offset = size.saturating_sub(self.initial_bytes);
                self.offset = Some(offset);
                self.partial.clear();
                if offset > 0 {
                    // Drop the record cut by the initial window.
                    let text = self.read(offset, size);
                    let start = text.find('\n').map_or(0, |index| index + 1);
                    return split_records(&text[start..]);
                }
                offset
            }
        };
        if size == offset {
            return Vec::new();
        }
        split_records(&self.read(offset, size))
    }

    fn read(&mut self, offset: u64, size: u64) -> String {
        // A file that vanished between stat and open reads as empty.
        let chunk = read_range(&self.path, offset, size - offset).unwrap_or_default();
        self.offset = Some(offset + chunk.len() as u64);
        // Keep bytes after the last newline so split multi-byte characters survive.
        let mut buffer = std::mem::take(&mut self.partial);
        buffer.extend_from_slice(&chunk);
        let end = buffer
            .iter()
            .rposition(|&byte| byte == b'\n')
            .map_or(0, |index| index + 1);
        // Copy so the leftover bytes do not keep the whole read buffer alive.
        self.partial = buffer[end..].to_vec();
        String::from_utf8_lossy(&buffer[..end]).into_owned()
    }
}

#[derive(Clone, Debug, Default)]
pub struct LogSummary {
    pub title: Option<String>,
    pub model: Option<String>,
    pub status: Option<SessionStatus>,
    pub last: Option<String>,
}

/// Keeps per-file summaries current by folding every appended record, so a
/// large burst of output can never hide a status or model change.
pub struct SummaryTracker {
    reduce: fn(&mut LogSummary, &JsonObject),
    entries: HashMap<PathBuf, (JsonlTail, LogSummary)>,
    seen: HashSet<PathBuf>,
}

impl SummaryTracker {
    pub fn new(reduce: fn(&mut LogSummary, &JsonObject)) -> Self {
        Self {
            reduce,
            entries: HashMap::new(),
            seen: HashSet::new(),
        }
    }

    pub fn summarize(&mut self, path: &Path) -> LogSummary {
        self.seen.insert(path.to_path_buf());
        let (tail, summary) = self
            .entries
            .entry(path.to_path_buf())
            .or_insert_with(|| (JsonlTail::new(path, u64::MAX), LogSummary::default()));
        for record in tail.poll() {
            (self.reduce)(summary, &record);
        }
        summary.clone()
    }

    /// Drop state for files not summarized since the previous call.
    pub fn prune(&mut self) {
        let seen = std::mem::take(&mut self.seen);
        self.entries.retain(|path, _| seen.contains(path));
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use serde_json::json;
    use std::io::Write;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// A fresh temporary directory removed on drop.
    pub struct TempDir(pub PathBuf);

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

    fn records(values: &[serde_json::Value]) -> Vec<JsonObject> {
        values
            .iter()
            .map(|value| value.as_object().unwrap().clone())
            .collect()
    }

    #[test]
    fn follows_appended_records_and_buffers_partial_lines() {
        let dir = TempDir::new();
        let path = dir.0.join("log.jsonl");
        fs::write(&path, "{\"n\":1}\n{\"n\":").unwrap();
        let mut tail = JsonlTail::new(&path, 1024);
        assert_eq!(tail.poll(), records(&[json!({"n": 1})]));
        assert_eq!(tail.poll(), vec![]);
        append(&path, b"2}\n{\"n\":3}\n");
        assert_eq!(tail.poll(), records(&[json!({"n": 2}), json!({"n": 3})]));
    }

    #[test]
    fn does_not_retain_the_read_buffer_for_a_pending_partial_line() {
        let dir = TempDir::new();
        let path = dir.0.join("log.jsonl");
        fs::write(&path, format!("{}{{\"n\":", "{\"n\":1}\n".repeat(100_000))).unwrap();
        let mut tail = JsonlTail::new(&path, u64::MAX);
        assert_eq!(tail.poll().len(), 100_000);
        assert_eq!(tail.partial, b"{\"n\":");
        // The file is ~800 KB; the copied remainder must not keep it alive.
        assert!(tail.partial.capacity() < 256 * 1024);
    }

    #[test]
    fn skips_the_record_cut_by_the_initial_window() {
        let dir = TempDir::new();
        let path = dir.0.join("log.jsonl");
        fs::write(&path, "{\"long\":\"xxxxxxxxxxxxxxxx\"}\n{\"n\":1}\n").unwrap();
        assert_eq!(
            JsonlTail::new(&path, 12).poll(),
            records(&[json!({"n": 1})])
        );
    }

    #[test]
    fn keeps_multi_byte_characters_split_across_reads() {
        let dir = TempDir::new();
        let path = dir.0.join("log.jsonl");
        let bytes = "{\"t\":\"日\"}\n".as_bytes();
        fs::write(&path, &bytes[..7]).unwrap();
        let mut tail = JsonlTail::new(&path, 1024);
        assert_eq!(tail.poll(), vec![]);
        append(&path, &bytes[7..]);
        assert_eq!(tail.poll(), records(&[json!({"t": "日"})]));
    }
}
