use std::path::Path;
use std::process::Stdio;

use crate::context::{Context, inside_tmux};
use crate::error::Result;
use crate::process::CommandExt;
use crate::shell::bash_read_tab_fields;
use crate::state::write_line;

impl Context {
    fn list_windows<const N: usize>(&self, format: &str) -> Vec<[String; N]> {
        if !inside_tmux() {
            return Vec::new();
        }
        self.tmux(["list-windows", "-F", format])
            .discard_stderr()
            .stdout_text()
            .lines()
            .map(bash_read_tab_fields::<N>)
            .collect()
    }

    /// A window whose `@worktree_path` or pane path is `path`.
    fn window_for_path(&self, path: &str) -> Option<String> {
        self.list_windows::<3>("#{window_id}\t#{@worktree_path}\t#{pane_current_path}")
            .into_iter()
            .find(|[_, option, pane]| option == path || pane == path)
            .map(|[id, ..]| id)
    }

    fn window_for_option_path(&self, path: &str) -> Option<String> {
        self.list_windows::<2>("#{window_id}\t#{@worktree_path}")
            .into_iter()
            .find(|[_, option]| option == path)
            .map(|[id, _]| id)
    }

    pub fn window_name_for_path(&self, path: &str) -> Option<String> {
        self.list_windows::<2>("#{window_name}\t#{@worktree_path}")
            .into_iter()
            .find(|[_, option]| option == path)
            .map(|[name, _]| name)
    }

    fn current_window_id(&self) -> Option<String> {
        if !inside_tmux() {
            return None;
        }
        let captured = self
            .tmux(["display-message", "-p", "#{window_id}"])
            .discard_stderr()
            .capture();
        captured.success().then_some(captured.stdout)
    }

    fn pin_window_options(&self, target: Option<&str>, path: &str) {
        for (option, value) in [
            ("automatic-rename", "off"),
            ("allow-rename", "off"),
            ("@worktree_path", path),
        ] {
            let mut command = self.tmux(["set-window-option"]);
            if let Some(id) = target {
                command.args(["-t", id]);
            }
            command.args([option, value]).run_without_stdout();
        }
    }

    /// Select or open a tmux window for `path`; outside tmux, emit a cd directive.
    pub fn open_path(&self, path: &str, window: &str) -> Result<()> {
        if !inside_tmux() {
            return write_cd_directive(path);
        }
        if self.is_main_checkout_path(path) {
            return match self.window_for_path(path) {
                Some(id) => self.tmux(["select-window", "-t", &id]).checked(),
                None => self
                    .tmux(["new-window", "-c", path])
                    .stdout(Stdio::null())
                    .checked(),
            };
        }
        let id = match self.window_for_path(path) {
            Some(id) => {
                self.tmux(["select-window", "-t", &id]).checked()?;
                id
            }
            None => self
                .tmux([
                    "new-window",
                    "-P",
                    "-F",
                    "#{window_id}",
                    "-n",
                    window,
                    "-c",
                    path,
                ])
                .checked_stdout()?,
        };
        self.tmux(["rename-window", "-t", &id, window])
            .run_without_stdout();
        self.pin_window_options(Some(&id), path);
        Ok(())
    }

    /// Close the window of a deleted worktree, moving away first when it is current.
    pub fn close_window_for_deleted_path(&self, path: &str, destination: &str) {
        if !inside_tmux() {
            return;
        }
        let Some(id) = self
            .window_for_option_path(path)
            .filter(|id| !id.is_empty())
        else {
            return;
        };
        if self.current_window_id().as_deref() == Some(id.as_str()) {
            match self.window_for_option_path(destination) {
                Some(destination_id) => {
                    self.tmux(["select-window", "-t", &destination_id]).run();
                }
                None => {
                    self.tmux(["select-window", "-t", "!"])
                        .discard_stderr()
                        .run();
                }
            }
        }
        self.tmux(["kill-window", "-t", &id]).discard_stderr().run();
    }

    pub fn rename_current_window(&self, window: &str, path: &str) -> Result<()> {
        self.tmux(["rename-window", window]).checked()?;
        self.pin_window_options(None, path);
        Ok(())
    }
}

/// Tell the shell wrapper (through `WORKTREE_CD_FILE`) or the user where to go.
pub fn write_cd_directive(path: &str) -> Result<()> {
    match std::env::var("WORKTREE_CD_FILE") {
        Ok(file) if !file.is_empty() => write_line(Path::new(&file), path),
        _ => {
            println!("Switch to: {path}");
            Ok(())
        }
    }
}
