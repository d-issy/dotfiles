mod config;
mod targets;

use config::Config;
use dot::json::{self, Value};
use dot::process::wait_with_input;
use std::error::Error;
use std::ffi::OsString;
use std::io::{self, Write};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;
use targets::{Selection, Workspace};

type Result<T> = std::result::Result<T, Box<dyn Error>>;

struct App {
    config: Config,
    config_path: PathBuf,
    herdr: OsString,
}

impl App {
    fn herdr(&self, args: &[&str]) -> Command {
        let mut command = Command::new(&self.herdr);
        command.args(args);
        command
    }

    fn capture(&self, args: &[&str]) -> Result<String> {
        let output = self.herdr(args).stderr(Stdio::inherit()).output()?;
        if !output.status.success() {
            return Err(format!("herdr {} failed ({})", args.join(" "), output.status).into());
        }
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }

    fn json(&self, args: &[&str]) -> Result<Value> {
        Ok(json::from_str(&self.capture(args)?)?)
    }

    fn run(&self, args: &[&str], quiet: bool) -> Result<()> {
        let mut command = self.herdr(args);
        if quiet {
            command.stdout(Stdio::null());
        }
        let status = command.status()?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("herdr {} failed ({status})", args.join(" ")).into())
        }
    }

    // Candidate discovery is best effort: an absent server must not prevent
    // selecting a repository and starting it through hr.
    fn workspaces(&self) -> Vec<Workspace> {
        self.herdr(&["workspace", "list"])
            .stderr(Stdio::null())
            .output()
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| {
                json::from_str::<Value>(&String::from_utf8_lossy(&output.stdout)).ok()
            })
            .map(|value| targets::workspaces(&value))
            .unwrap_or_default()
    }

    fn repo_targets(&self) -> String {
        let output = Command::new(&self.config.ghq)
            .args(["list", "-p"])
            .stderr(Stdio::null())
            .output();
        match output {
            Ok(output) if output.status.success() => targets::repos(
                &String::from_utf8_lossy(&output.stdout),
                self.config.include_parents,
            ),
            _ => String::new(),
        }
    }

    fn server_ready(&self) -> bool {
        self.herdr(&["status", "server", "--json"])
            .stderr(Stdio::null())
            .output()
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| {
                json::from_str::<Value>(&String::from_utf8_lossy(&output.stdout)).ok()
            })
            .is_some_and(|value| {
                value.get("running").and_then(Value::as_bool) == Some(true)
                    && value.get("compatible").and_then(Value::as_bool) == Some(true)
            })
    }

    fn start_server(&self, cwd: &Path) -> Result<()> {
        let mut child = self
            .herdr(&["server"])
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        for _ in 0..50 {
            if self.server_ready() {
                return Ok(());
            }
            // Reap a server that failed to start rather than leaving a zombie
            // while waiting out the timeout.
            let _ = child.try_wait()?;
            std::thread::sleep(Duration::from_millis(100));
        }
        Err("timed out waiting for the Herdr server to start".into())
    }

    fn callback(&self, action: &str) -> Result<String> {
        Ok(format!(
            "{} --config {} {action}",
            shell_quote(&std::env::current_exe()?.to_string_lossy()),
            shell_quote(&self.config_path.to_string_lossy()),
        ))
    }

    fn select(&self, workspaces: &[Workspace]) -> Result<Option<Selection>> {
        let show_workspaces = self.config.attach || !workspaces.is_empty();
        let input = if show_workspaces {
            targets::workspace_rows(workspaces)
        } else {
            self.repo_targets()
        };
        let mut command = Command::new(&self.config.fuzzy_finder);
        command.args(["--delimiter=\t", "--with-nth=3"]);
        if show_workspaces {
            command.arg(if self.config.attach {
                "--header=Ctrl-R: repos/orgs  Ctrl-D: delete"
            } else {
                "--header=Ctrl-R: repos/orgs"
            });
            command.arg(format!(
                "--bind=ctrl-r:reload({})+change-header(Repos/orgs)",
                self.callback("repo-targets")?
            ));
            if self.config.attach {
                command.arg(format!(
                    "--bind=ctrl-d:execute({} {{2}})+reload({})",
                    self.callback("close-workspace")?,
                    self.callback("workspace-targets")?
                ));
            }
        } else {
            command.arg("--header=Repos/orgs");
        }
        let child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;
        let output = wait_with_input(child, input.as_bytes())?;
        if !output.status.success() {
            return Ok(None);
        }
        Ok(Selection::parse(&String::from_utf8_lossy(&output.stdout)))
    }

    fn open_repo(&self, path: &str, label: &str, server_running: bool) -> Result<()> {
        if !Path::new(path).is_dir() {
            return Ok(());
        }
        let path = Path::new(path).canonicalize()?;
        if self.config.attach && !server_running {
            // The shell implementation changed directory before bootstrapping:
            // readiness probes and the eventual client must use that repo too.
            std::env::set_current_dir(&path)?;
            self.start_server(&path)?;
        }
        let path = path.to_string_lossy();
        let label = if label.is_empty() {
            Path::new(path.as_ref())
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("/")
        } else {
            label
        };
        let workspaces = targets::workspaces(&self.json(&["workspace", "list"])?);
        let mut id = workspaces
            .iter()
            .find(|workspace| workspace.matches_repo(&path))
            .map(|workspace| workspace.id.clone());
        if id.is_none() {
            for workspace in workspaces
                .iter()
                .filter(|workspace| !workspace.has_repo_token)
            {
                if let Ok(panes) = self.json(&["pane", "list", "--workspace", &workspace.id])
                    && targets::has_pane_cwd(&panes, &path)
                {
                    id = Some(workspace.id.clone());
                    break;
                }
            }
        }
        let id = match id {
            Some(id) => id,
            None => {
                let created = self.json(&[
                    "workspace",
                    "create",
                    "--cwd",
                    &path,
                    "--label",
                    label,
                    "--focus",
                ])?;
                created
                    .pointer("/result/workspace/workspace_id")
                    .and_then(Value::as_str)
                    .filter(|id| !id.is_empty())
                    .ok_or("workspace create returned no workspace_id")?
                    .to_string()
            }
        };
        self.run(
            &[
                "workspace",
                "report-metadata",
                &id,
                "--source",
                "dotfiles",
                "--token",
                &format!("dot_repo_path={path}"),
            ],
            true,
        )?;
        self.run(&["workspace", "focus", &id], self.config.attach)
    }

    fn interactive(&self) -> Result<()> {
        let server_running = self.config.attach && self.server_ready();
        let workspaces = self.workspaces();
        let Some(selected) = self.select(&workspaces)? else {
            return Ok(());
        };
        match selected {
            Selection::Workspace(id) => {
                self.run(&["workspace", "focus", &id], self.config.attach)?;
            }
            Selection::Repo { path, label } => {
                if !Path::new(&path).is_dir() {
                    return Ok(());
                }
                self.open_repo(&path, &label, server_running)?;
            }
        }
        if self.config.attach {
            return Err(self.herdr(&[]).exec().into());
        }
        Ok(())
    }
}

// fzf runs reload/execute actions through a shell. Keep executable and config
// paths literal, including apostrophes and spaces; fzf quotes its {2} placeholder.
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn run() -> Result<()> {
    let mut args = std::env::args_os().skip(1);
    if args.next().as_deref() != Some(std::ffi::OsStr::new("--config")) {
        return Err("usage: herdr-switcher --config PATH [repo-targets|workspace-targets|close-workspace ID]".into());
    }
    let config_path = PathBuf::from(args.next().ok_or("missing config path")?).canonicalize()?;
    let config: Config = json::from_str(&std::fs::read_to_string(&config_path)?)?;
    let herdr = std::env::var_os("HERDR_BIN_PATH")
        .filter(|path| !path.is_empty())
        .unwrap_or_else(|| OsString::from(&config.herdr));
    let app = App {
        config,
        config_path,
        herdr,
    };
    let action = args.next();
    let remaining: Vec<_> = args.collect();
    match action.as_deref().and_then(|arg| arg.to_str()) {
        None if action.is_none() && remaining.is_empty() => app.interactive(),
        Some("repo-targets") if remaining.is_empty() => {
            io::stdout().write_all(app.repo_targets().as_bytes())?;
            Ok(())
        }
        Some("workspace-targets") if remaining.is_empty() => {
            io::stdout().write_all(targets::workspace_rows(&app.workspaces()).as_bytes())?;
            Ok(())
        }
        Some("close-workspace") if remaining.len() == 1 => {
            let id = remaining[0].to_str().ok_or("invalid workspace ID")?;
            app.run(&["workspace", "close", id], true)
        }
        _ => Err("invalid action or arguments".into()),
    }
}

fn main() {
    if let Err(error) = run() {
        // A downstream reader closing a candidate pipe is not an application failure.
        if error
            .downcast_ref::<io::Error>()
            .is_some_and(|error| error.kind() == io::ErrorKind::BrokenPipe)
        {
            return;
        }
        eprintln!("herdr-switcher: {error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_shell_metacharacters_in_callback_paths() {
        assert_eq!(shell_quote("/a b/c'd;$HOME"), "'/a b/c'\\''d;$HOME'");
    }
}
