use crate::error::{Error, JQ_RUNTIME_ERROR, Result, die};
use crate::fsutil::{
    ensure_private_directory, path_with_suffix, read_file, write_private_atomically,
};
use crate::herdr::Herdr;
use crate::json;
use crate::manifest::Manifest;
use dot::json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub struct Session {
    pub herdr: Herdr,
    pub workspace: String,
    pub tab: String,
    pub pane: String,
    pub cwd: String,
    state_dir: PathBuf,
    manifest_path: PathBuf,
}

fn env_nonempty(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

fn required_env(name: &str) -> Result<String> {
    env_nonempty(name).map_or_else(|| die(format!("{name} is not set")), Ok)
}

fn sha256_prefix(text: &str) -> String {
    dot::hash::sha256_hex(text.as_bytes())[..16].to_string()
}

fn logical_cwd() -> String {
    let actual = std::env::current_dir().unwrap_or_default();
    if let Some(pwd) = env_nonempty("PWD")
        && let (Ok(logical), Ok(physical)) = (fs::canonicalize(&pwd), fs::canonicalize(&actual))
        && logical == physical
    {
        return pwd;
    }
    actual.to_string_lossy().to_string()
}

impl Session {
    pub fn from_env() -> Result<Self> {
        if std::env::var("HERDR_ENV").as_deref() != Ok("1") {
            return die("must run inside Herdr");
        }
        let socket = required_env("HERDR_SOCKET_PATH")?;
        let workspace = required_env("HERDR_WORKSPACE_ID")?;
        let tab = required_env("HERDR_TAB_ID")?;
        let pane = required_env("HERDR_PANE_ID")?;

        let herdr_bin = env_nonempty("HERDR_BIN_PATH")
            .or_else(|| env_nonempty("HERDR_SUBAGENTS_DEFAULT_HERDR"))
            .unwrap_or_else(|| "herdr".to_string());
        let base = env_nonempty("XDG_RUNTIME_DIR")
            .or_else(|| env_nonempty("TMPDIR"))
            .unwrap_or_else(|| "/tmp".to_string());
        let runtime_root = Path::new(&base).join("herdr-subagents");
        let state_dir = runtime_root.join(sha256_prefix(&socket));
        let manifest_path = state_dir.join(format!(
            "{}.json",
            sha256_prefix(&format!("{workspace}:{tab}:{pane}"))
        ));
        ensure_private_directory(&runtime_root)?;
        ensure_private_directory(&state_dir)?;

        Ok(Self {
            herdr: Herdr::new(herdr_bin),
            workspace,
            tab,
            pane,
            cwd: logical_cwd(),
            state_dir,
            manifest_path,
        })
    }

    pub fn lock_path(&self) -> PathBuf {
        path_with_suffix(&self.manifest_path, ".lock")
    }

    pub fn manifest_exists(&self) -> bool {
        fs::symlink_metadata(&self.manifest_path).is_ok()
    }

    pub fn require_manifest(&self) -> Result<Manifest> {
        let regular = fs::symlink_metadata(&self.manifest_path).is_ok_and(|meta| meta.is_file());
        if !regular {
            return die("no regular subagent manifest exists for the current pane");
        }
        fs::read_to_string(&self.manifest_path)
            .ok()
            .and_then(|text| Manifest::parse(&text).ok())
            .filter(|manifest| manifest.belongs_to(self))
            .map_or_else(
                || die("manifest does not belong to the current Herdr context"),
                Ok,
            )
    }

    pub fn read_manifest(&self) -> Result<Manifest> {
        Manifest::parse(&read_file(&self.manifest_path)?)
    }

    pub fn write_manifest(&self, manifest: &Manifest) -> Result<()> {
        write_private_atomically(&self.manifest_path, &manifest.to_file_content())
    }

    pub fn discard_manifest(&self) {
        let _ = fs::remove_file(&self.manifest_path);
        let _ = fs::remove_dir(&self.state_dir);
    }

    pub fn list_panes(&self) -> Result<Vec<Value>> {
        let text = self
            .herdr
            .capture(&["pane", "list", "--workspace", &self.workspace])?;
        json::parse(&text, "herdr pane list")?
            .pointer("/result/panes")
            .and_then(Value::as_array)
            .cloned()
            .ok_or(Error::Exit(JQ_RUNTIME_ERROR))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha_prefix_is_sixteen_hex_digits() {
        assert_eq!(sha256_prefix(""), "e3b0c44298fc1c14");
    }
}
