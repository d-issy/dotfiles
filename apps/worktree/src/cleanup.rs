use std::fmt;
use std::path::{Path, PathBuf};

use crate::context::Context;
use crate::process::CommandExt;
use crate::temp::TempDir;
use crate::ui::Color;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CleanupFailure {
    SourceMissing(String),
    IndexUnsafe(String),
    WorkingTreeUnsafe(String),
    IndexFailed(String),
}

impl fmt::Display for CleanupFailure {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::SourceMissing(source) => write!(f, "Source worktree no longer exists: {source}"),
            Self::IndexUnsafe(source) => write!(
                f,
                "Could not remove original staged changes from index safely. They remain staged in: {source}"
            ),
            Self::WorkingTreeUnsafe(source) => write!(
                f,
                "Could not remove original staged changes from working tree safely. They remain staged in: {source}"
            ),
            Self::IndexFailed(source) => write!(
                f,
                "Could not remove original staged changes from index safely. Pending state remains for recovery: {source}"
            ),
        }
    }
}

impl Context {
    /// Reverse the staged patch in `source`, working tree first and then the
    /// index, leaving both untouched when that cannot be done safely.
    pub fn remove_staged_patch(&self, source: &str, patch: &Path) -> Result<(), CleanupFailure> {
        if !self.is_dir(source) {
            return Err(CleanupFailure::SourceMissing(source.to_string()));
        }
        let reverse = |extra: &[&str]| {
            let mut command = self.git(["-C", source, "apply", "-R"]);
            command.args(extra).arg(patch);
            command
        };

        if reverse(&["--cached", "--unidiff-zero", "--check"]).run_silently() != 0 {
            return Err(CleanupFailure::IndexUnsafe(source.to_string()));
        }
        let working_tree_reversed = if reverse(&["--unidiff-zero", "--check"]).run_silently() == 0 {
            reverse(&["--unidiff-zero"]).run() == 0
        } else {
            self.reverse_with_gnu_patch(source, patch)
        };
        if !working_tree_reversed {
            return Err(CleanupFailure::WorkingTreeUnsafe(source.to_string()));
        }
        if reverse(&["--cached", "--unidiff-zero"]).run() != 0 {
            return Err(CleanupFailure::IndexFailed(source.to_string()));
        }
        println!(
            "{}",
            Color::Green.paint("Removed original staged changes from index.")
        );
        Ok(())
    }

    /// Fallback for when `git apply -R` refuses the working tree; staged paths
    /// are backed up so a partial reversal can be undone.
    fn reverse_with_gnu_patch(&self, source: &str, patch: &Path) -> bool {
        let backup = match Backup::of_staged_paths(self, source) {
            Ok(backup) => backup,
            Err(err) => {
                err.report();
                return false;
            }
        };
        let reject = backup.dir.path().join("reject");
        let status = match std::fs::File::open(self.resolve(patch)) {
            Ok(input) => self
                .command(&self.config.patch)
                .current_dir(self.resolve(source))
                .args(["--batch", "--forward", "--fuzz=0", "-p1", "-R"])
                .arg(format!("--reject-file={}", reject.display()))
                .stdin(input)
                .run_silently(),
            Err(_) => 1,
        };
        let rejected = std::fs::metadata(&reject).is_ok_and(|meta| meta.len() > 0);
        if status == 0 && !rejected {
            return true;
        }
        backup.restore(Path::new(source));
        false
    }
}

struct BackupEntry {
    path: String,
    present: bool,
}

struct Backup {
    dir: TempDir,
    entries: Vec<BackupEntry>,
}

impl Backup {
    fn files(&self) -> PathBuf {
        files_dir(&self.dir)
    }

    fn of_staged_paths(ctx: &Context, source: &str) -> crate::error::Result<Self> {
        let dir = TempDir::new()?;
        let files = files_dir(&dir);
        let names = ctx
            .git(["-C", source, "diff", "--cached", "--name-only", "-z"])
            .capture_bytes()
            .stdout;
        let entries = names
            .split(|byte| *byte == 0)
            .filter(|raw| !raw.is_empty())
            .map(|raw| {
                let path = String::from_utf8_lossy(raw).into_owned();
                let original = Path::new(source).join(&path);
                let present = original.symlink_metadata().is_ok();
                if present {
                    let _ = std::fs::create_dir_all(parent_of(&files, &path));
                    let _ = copy_preserving(&original, &files.join(&path));
                }
                BackupEntry { path, present }
            })
            .collect();
        Ok(Self { dir, entries })
    }

    fn restore(&self, source: &Path) {
        let files = self.files();
        for entry in &self.entries {
            let target = source.join(&entry.path);
            if let Ok(meta) = target.symlink_metadata() {
                let _ = if meta.is_dir() {
                    std::fs::remove_dir_all(&target)
                } else {
                    std::fs::remove_file(&target)
                };
            }
            if entry.present {
                let _ = std::fs::create_dir_all(parent_of(source, &entry.path));
                let _ = copy_preserving(&files.join(&entry.path), &target);
            }
        }
    }
}

fn files_dir(dir: &TempDir) -> PathBuf {
    dir.path().join("files")
}

fn parent_of(base: &Path, relative: &str) -> PathBuf {
    match relative.rsplit_once('/') {
        Some((dir, _)) => base.join(dir),
        None => base.to_path_buf(),
    }
}

/// `cp -a` for files, directories and symlinks.
fn copy_preserving(from: &Path, to: &Path) -> std::io::Result<()> {
    let meta = from.symlink_metadata()?;
    if meta.file_type().is_symlink() {
        std::os::unix::fs::symlink(std::fs::read_link(from)?, to)
    } else if meta.is_dir() {
        std::fs::create_dir_all(to)?;
        std::fs::set_permissions(to, meta.permissions())?;
        for entry in std::fs::read_dir(from)? {
            let entry = entry?;
            copy_preserving(&entry.path(), &to.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        std::fs::copy(from, to).map(drop)
    }
}
