use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::config::Config;
use crate::process;

#[derive(Debug, Clone)]
pub struct Context {
    pub cwd: PathBuf,
    pub config: Config,
}

impl Context {
    pub fn new(cwd: PathBuf, config: Config) -> Self {
        let cwd = std::fs::canonicalize(&cwd).unwrap_or(cwd);
        Self { cwd, config }
    }

    pub fn with_cwd(&self, cwd: PathBuf) -> Self {
        Self::new(cwd, self.config.clone())
    }

    pub fn command(&self, program: impl AsRef<OsStr>) -> Command {
        let mut command = Command::new(program);
        command.current_dir(&self.cwd);
        command
    }

    fn command_with<I, S>(&self, program: &str, args: I) -> Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        let mut command = self.command(program);
        command.args(args);
        command
    }

    pub fn git<I, S>(&self, args: I) -> Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        self.command_with(&self.config.git, args)
    }

    pub fn tmux<I, S>(&self, args: I) -> Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        self.command_with(&self.config.tmux, args)
    }

    pub fn gh<I, S>(&self, args: I) -> Command
    where
        I: IntoIterator<Item = S>,
        S: AsRef<OsStr>,
    {
        self.command_with(&self.config.gh, args)
    }

    pub fn fuzzy_select(&self, lines: &str, header: &str, with_nth: &str) -> String {
        let mut command = self.command(&self.config.fuzzy_finder);
        command
            .arg(format!("--header={header}"))
            .arg(format!("--with-nth={with_nth}"));
        process::fuzzy_select(command, lines)
    }

    pub fn resolve(&self, path: impl AsRef<Path>) -> PathBuf {
        self.cwd.join(path)
    }

    /// GNU `realpath`: the last component may be missing; unresolvable input is returned as is.
    pub fn realpath(&self, path: &str) -> String {
        if path.is_empty() {
            return String::new();
        }
        let full = self.resolve(path);
        if let Ok(real) = std::fs::canonicalize(&full) {
            return real.to_string_lossy().into_owned();
        }
        if let (Some(parent), Some(name)) = (full.parent(), full.file_name())
            && let Ok(real) = std::fs::canonicalize(parent)
        {
            return real.join(name).to_string_lossy().into_owned();
        }
        path.to_string()
    }

    pub fn exists(&self, path: &str) -> bool {
        !path.is_empty() && self.resolve(path).exists()
    }

    pub fn exists_or_symlink(&self, path: &str) -> bool {
        !path.is_empty() && self.resolve(path).symlink_metadata().is_ok()
    }

    pub fn is_dir(&self, path: &str) -> bool {
        !path.is_empty() && self.resolve(path).is_dir()
    }
}

pub fn inside_tmux() -> bool {
    std::env::var_os("TMUX").is_some_and(|value| !value.is_empty())
}
