use std::path::{Path, PathBuf};

use crate::context::Context;
use crate::error::{Error, Result};
use crate::shell::strip_trailing_newlines;

const STATE_SUBDIR: &str = "worktree/create";

/// A staged-change `create` that still needs `create --finish`, kept under
/// `<git common dir>/worktree/create/<hash of the target path>/`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PendingState {
    pub dir: PathBuf,
}

/// `$(<file)`; None when the file cannot be read.
pub fn read_trimmed(path: &Path) -> Option<String> {
    std::fs::read(path)
        .ok()
        .map(|bytes| strip_trailing_newlines(&String::from_utf8_lossy(&bytes)).to_string())
}

pub fn write_line(path: &Path, value: &str) -> Result<()> {
    std::fs::write(path, format!("{value}\n"))
        .map_err(|err| Error::io(format!("worktree: {}", path.display()), err))
}

impl Context {
    fn state_root(&self) -> String {
        format!("{}/{STATE_SUBDIR}", self.common_git_dir())
    }

    pub fn pending_state_for(&self, target: &str) -> PendingState {
        PendingState {
            dir: PathBuf::from(format!("{}/{}", self.state_root(), self.hash_text(target))),
        }
    }

    /// The state for the current worktree, looked up by hash first and then by
    /// scanning every state directory's `target_path`.
    pub fn pending_state_for_current(&self) -> Option<PendingState> {
        let target = self.repo_root();
        let state = self.pending_state_for(&target);
        if state.targets(&target) {
            return Some(state);
        }
        let mut candidates: Vec<PendingState> = std::fs::read_dir(self.state_root())
            .into_iter()
            .flatten()
            .flatten()
            .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
            .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
            .map(|entry| PendingState::with_fd_trailing_slash(&entry.path()))
            .collect();
        candidates.sort_by(|a, b| a.dir.as_os_str().cmp(b.dir.as_os_str()));
        candidates
            .into_iter()
            .find(|candidate| candidate.targets(&target))
    }

    pub fn remove_pending_state_for(&self, path: &str) {
        let state = self.pending_state_for(path);
        if state.targets(path) {
            state.remove();
        }
    }
}

impl PendingState {
    /// fd printed directories with a trailing slash, which shows up in messages.
    fn with_fd_trailing_slash(path: &Path) -> Self {
        Self {
            dir: PathBuf::from(format!("{}/", path.display())),
        }
    }

    pub fn file(&self, name: &str) -> PathBuf {
        self.dir.join(name)
    }

    pub fn field(&self, name: &str) -> Option<String> {
        read_trimmed(&self.file(name))
    }

    pub fn targets(&self, target: &str) -> bool {
        let file = self.file("target_path");
        file.is_file() && read_trimmed(&file).as_deref() == Some(target)
    }

    pub fn create(&self) -> Result<()> {
        std::fs::create_dir_all(&self.dir)
            .map_err(|err| Error::io(format!("mkdir: {}", self.dir.display()), err))
    }

    pub fn write_bytes(&self, name: &str, bytes: &[u8]) -> Result<()> {
        let path = self.file(name);
        std::fs::write(&path, bytes)
            .map_err(|err| Error::io(format!("worktree: {}", path.display()), err))
    }

    pub fn write_field(&self, name: &str, value: &str) -> Result<()> {
        write_line(&self.file(name), value)
    }

    pub fn remove(&self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }

    pub fn move_to(&self, destination: &Self) -> Result<()> {
        if let Some(parent) = destination.dir.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        std::fs::rename(&self.dir, &destination.dir).map_err(|err| {
            Error::io(
                format!(
                    "mv: cannot move '{}' to '{}'",
                    self.dir.display(),
                    destination.dir.display()
                ),
                err,
            )
        })
    }
}
