mod targets;

use dot::config::Object;
use dot::json::{self, Decode, Value};
use dot::process::wait_with_input;
use dot::shell::strip_trailing_newlines;
use std::error::Error;
use std::io::{self, Write};
use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use targets::Selection;

type Result<T> = std::result::Result<T, Box<dyn Error>>;

struct Config {
    tmux: String,
    ghq: String,
    fuzzy_finder: String,
    include_parents: bool,
}

impl Decode for Config {
    fn decode(value: Value) -> std::result::Result<Self, json::Error> {
        let mut object = Object::new(value)?;
        Ok(Self {
            tmux: object.required("tmux")?,
            ghq: object.required("ghq")?,
            fuzzy_finder: object.required("fuzzyFinder")?,
            include_parents: object.field_or("includeParentDirectories", false)?,
        })
    }
}

struct App {
    config: Config,
    config_path: PathBuf,
}

impl App {
    fn tmux(&self, args: &[&str]) -> Command {
        let mut command = Command::new(&self.config.tmux);
        command.args(args);
        command
    }

    fn has_session(&self, name: Option<&str>) -> bool {
        let mut command = self.tmux(&["has-session"]);
        if let Some(name) = name {
            command.args(["-t", &format!("={name}")]);
        }
        command
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|status| status.success())
    }

    fn session_list(&self, format: &str) -> String {
        self.tmux(&["list-sessions", "-F", format])
            .stderr(Stdio::null())
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| String::from_utf8_lossy(&output.stdout).into_owned())
            .unwrap_or_default()
    }

    fn repo_targets(&self) -> String {
        Command::new(&self.config.ghq)
            .args(["list", "-p"])
            .stderr(Stdio::null())
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| {
                targets::repo_rows(
                    &String::from_utf8_lossy(&output.stdout),
                    self.config.include_parents,
                )
            })
            .unwrap_or_default()
    }

    fn run(&self, args: &[&str], quiet: bool) -> Result<()> {
        let mut command = self.tmux(args);
        if quiet {
            command.stdout(Stdio::null());
        }
        let status = command.status()?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("tmux {} failed ({status})", args.join(" ")).into())
        }
    }

    fn callback(&self, action: &str) -> Result<String> {
        Ok(format!(
            "{} --config {} {action}",
            shell_quote(&std::env::current_exe()?.to_string_lossy()),
            shell_quote(&self.config_path.to_string_lossy())
        ))
    }

    fn select(&self) -> Result<Option<Selection>> {
        let sessions_exist = self.has_session(None);
        let input = if sessions_exist {
            targets::session_rows(&self.session_list(targets::SESSION_FORMAT))
        } else {
            self.repo_targets()
        };
        let mut command = Command::new(&self.config.fuzzy_finder);
        command.args(["--delimiter=\t", "--with-nth=3"]);
        if sessions_exist {
            command
                .arg("--header=Ctrl-R: repos/orgs  Ctrl-D: delete")
                .arg(format!(
                    "--bind=ctrl-r:reload({})+change-header(Repos/orgs)",
                    self.callback("repo-targets")?
                ))
                .arg(format!(
                    "--bind=ctrl-d:execute({} {{2}})+reload({})",
                    self.callback("kill-session")?,
                    self.callback("session-targets")?
                ));
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

    fn repo_session(&self, selected: &str) -> Result<String> {
        let repo = PathBuf::from(selected).canonicalize()?;
        let repo_text = repo.to_str().ok_or("repository path is not valid UTF-8")?;
        let sessions = self.session_list(targets::PATH_FORMAT);
        let target = if let Some(id) = targets::session_for_repo(&sessions, &repo) {
            id
        } else {
            let name = targets::session_name(repo_text, |name| self.has_session(Some(name)));
            let output = self
                .tmux(&[
                    "new-session",
                    "-P",
                    "-F",
                    "#{session_id}",
                    "-s",
                    &name,
                    "-c",
                    repo_text,
                    "-d",
                ])
                .stderr(Stdio::inherit())
                .output()?;
            if !output.status.success() {
                return Err(format!("tmux new-session failed ({})", output.status).into());
            }
            let id = strip_trailing_newlines(&String::from_utf8_lossy(&output.stdout)).to_string();
            if id.is_empty() {
                return Err("tmux new-session returned no session ID".into());
            }
            id
        };
        self.run(
            &["set-option", "-t", &target, "@repo_path", repo_text],
            false,
        )?;
        Ok(target)
    }

    fn interactive(&self) -> Result<()> {
        let Some(selection) = self.select()? else {
            return Ok(());
        };
        let target = match selection {
            Selection::Session(id) => id,
            Selection::Repo(path) => self.repo_session(&path)?,
        };
        let action = if std::env::var_os("TMUX").is_none_or(|value| value.is_empty()) {
            "attach-session"
        } else {
            "switch-client"
        };
        Err(self.tmux(&[action, "-t", &target]).exec().into())
    }
}

// fzf invokes its actions through a shell. Quote paths ourselves and let fzf
// quote the selected {2} field.
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn run() -> Result<()> {
    let mut args = std::env::args_os().skip(1);
    if args.next().as_deref() != Some(std::ffi::OsStr::new("--config")) {
        return Err(
            "usage: tm-switcher --config PATH [repo-targets|session-targets|kill-session ID]"
                .into(),
        );
    }
    let config_path = PathBuf::from(args.next().ok_or("missing config path")?).canonicalize()?;
    let config = json::from_str(&std::fs::read_to_string(&config_path)?)?;
    let app = App {
        config,
        config_path,
    };
    let action = args.next();
    let remaining: Vec<_> = args.collect();
    match action.as_deref().and_then(|arg| arg.to_str()) {
        None if action.is_none() && remaining.is_empty() => app.interactive(),
        Some("repo-targets") if remaining.is_empty() => {
            io::stdout().write_all(app.repo_targets().as_bytes())?;
            Ok(())
        }
        Some("session-targets") if remaining.is_empty() => {
            io::stdout().write_all(
                targets::session_rows(&app.session_list(targets::SESSION_FORMAT)).as_bytes(),
            )?;
            Ok(())
        }
        Some("kill-session") if remaining.len() == 1 => {
            let id = remaining[0].to_str().ok_or("invalid session ID")?;
            app.run(&["kill-session", "-t", id], true)
        }
        _ => Err("invalid action or arguments".into()),
    }
}

fn main() {
    if let Err(error) = run() {
        if error
            .downcast_ref::<io::Error>()
            .is_some_and(|error| error.kind() == io::ErrorKind::BrokenPipe)
        {
            return;
        }
        eprintln!("tm-switcher: {error}");
        std::process::exit(1);
    }
}
