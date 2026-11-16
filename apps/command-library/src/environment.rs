use crate::library::Environment;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

pub struct SystemEnvironment {
    cwd: String,
    home: String,
    path_dirs: Vec<PathBuf>,
}

impl SystemEnvironment {
    pub fn new() -> Self {
        let path = std::env::var_os("PATH").unwrap_or_default();
        Self {
            cwd: std::env::current_dir()
                .map(|dir| dir.to_string_lossy().into_owned())
                .unwrap_or_default(),
            home: std::env::var("HOME").unwrap_or_default(),
            path_dirs: std::env::split_paths(&path)
                .filter(|dir| !dir.as_os_str().is_empty())
                .collect(),
        }
    }
}

impl Environment for SystemEnvironment {
    fn cwd(&self) -> &str {
        &self.cwd
    }

    fn home(&self) -> &str {
        &self.home
    }

    fn exists(&self, path: &str) -> bool {
        Path::new(path).exists()
    }

    fn has_command(&self, name: &str) -> bool {
        self.path_dirs.iter().any(|dir| {
            std::fs::metadata(dir.join(name))
                .is_ok_and(|metadata| metadata.permissions().mode() & 0o111 != 0)
        })
    }
}
