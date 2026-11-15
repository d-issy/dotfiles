//! Splits the current Pi pane in Herdr and manages the subagent panes started from it.

mod version;

use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use signal_hook::consts::{SIGINT, SIGTERM};
use signal_hook::iterator::Signals;
use std::collections::hash_map::RandomState;
use std::ffi::OsString;
use std::fs;
use std::hash::{BuildHasher, Hasher};
use std::io::Write;
use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt, PermissionsExt};
use std::os::unix::process::ExitStatusExt;
use std::path::{Path, PathBuf};
use std::process::{self, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const USAGE: &str = "Usage:
  herdr-subagents start NAME=PRESET [NAME=PRESET ...]
  herdr-subagents status
  herdr-subagents cleanup [--force]

Presets:
  pi  astra  sol  luna  opus  fable  grok  composer

Split the current Pi pane in half and manage equally sized Herdr subagent panes.
";

/// A failed run: optional `herdr-subagents: ...` message plus the exit code.
#[derive(Debug)]
struct Failure {
    code: i32,
    message: Option<String>,
}

type Res<T> = Result<T, Failure>;

fn die<T>(message: impl Into<String>) -> Res<T> {
    Err(Failure {
        code: 1,
        message: Some(message.into()),
    })
}

fn silent<T>(code: i32) -> Res<T> {
    Err(Failure {
        code,
        message: None,
    })
}

fn env_nonempty(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

fn sha256_prefix(text: &str) -> String {
    let digest = Sha256::digest(text.as_bytes());
    digest[..8]
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Renders a JSON value the way `jq -r` does.
fn raw(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}

/// `value // default` followed by `jq -r`.
fn raw_or(value: Option<&Value>, default: &str) -> String {
    match value {
        None | Some(Value::Null | Value::Bool(false)) => default.to_string(),
        Some(other) => raw(other),
    }
}

fn trim_newlines(text: &str) -> &str {
    text.trim_end_matches('\n')
}

fn parse_json(text: &str, what: &str) -> Res<Value> {
    serde_json::from_str(text).map_err(|error| Failure {
        code: 2,
        message: Some(format!("invalid JSON from {what}: {error}")),
    })
}

fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_default()
}

struct Output {
    success: bool,
    stdout: String,
    stderr: String,
}

impl Output {
    fn combined(&self) -> String {
        format!("{}{}", self.stdout, self.stderr)
    }
}

fn exit_code(status: process::ExitStatus) -> i32 {
    status
        .code()
        .or_else(|| status.signal().map(|signal| 128 + signal))
        .unwrap_or(1)
}

struct Herdr {
    bin: String,
}

impl Herdr {
    /// Runs Herdr with stderr passed through; a failing exit status ends the run with that status.
    fn capture(&self, args: &[&str]) -> Res<String> {
        let output = Command::new(&self.bin)
            .args(args)
            .stderr(Stdio::inherit())
            .output()
            .map_err(|error| Failure {
                code: 127,
                message: Some(format!("{}: {error}", self.bin)),
            })?;
        if !output.status.success() {
            return silent(exit_code(output.status));
        }
        Ok(trim_newlines(&String::from_utf8_lossy(&output.stdout)).to_string())
    }

    fn run_collecting(&self, args: &[String]) -> Output {
        match Command::new(&self.bin).args(args).output() {
            Ok(output) => Output {
                success: output.status.success(),
                stdout: String::from_utf8_lossy(&output.stdout).to_string(),
                stderr: String::from_utf8_lossy(&output.stderr).to_string(),
            },
            Err(error) => Output {
                success: false,
                stdout: String::new(),
                stderr: format!("{}: {error}\n", self.bin),
            },
        }
    }

    fn close_quietly(&self, pane: &str) {
        let _ = Command::new(&self.bin)
            .args(["pane", "close", pane])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

struct Context {
    herdr: Herdr,
    workspace: String,
    tab: String,
    pane: String,
    cwd: String,
    state_dir: PathBuf,
    manifest: PathBuf,
}

fn require_context() -> Res<(String, String, String, String)> {
    if std::env::var("HERDR_ENV").as_deref() != Ok("1") {
        return die("must run inside Herdr");
    }
    let get = |name: &str| env_nonempty(name).map_or_else(|| die(format!("{name} is not set")), Ok);
    Ok((
        get("HERDR_SOCKET_PATH")?,
        get("HERDR_WORKSPACE_ID")?,
        get("HERDR_TAB_ID")?,
        get("HERDR_PANE_ID")?,
    ))
}

fn ensure_private_directory(directory: &Path) -> Res<()> {
    if fs::DirBuilder::new().mode(0o700).create(directory).is_ok() {
        return Ok(());
    }
    // Never trust pre-existing paths under a shared temporary directory.
    let owned_directory = fs::symlink_metadata(directory)
        .ok()
        .filter(|meta| meta.is_dir() && meta.uid() == rustix::process::geteuid().as_raw());
    let Some(meta) = owned_directory else {
        return die(format!(
            "state directory must be owned by the current user and not be a symlink: {}",
            directory.display()
        ));
    };
    if meta.permissions().mode() & 0o7777 != 0o700 {
        return die(format!(
            "state directory must have mode 700: {}",
            directory.display()
        ));
    }
    Ok(())
}

/// The logical working directory, like `$PWD` in a shell.
fn logical_cwd() -> String {
    let actual = std::env::current_dir().unwrap_or_default();
    if let Some(pwd) = env_nonempty("PWD")
        && let (Ok(a), Ok(b)) = (fs::canonicalize(&pwd), fs::canonicalize(&actual))
        && a == b
    {
        return pwd;
    }
    actual.to_string_lossy().to_string()
}

fn init_context() -> Res<Context> {
    let (socket, workspace, tab, pane) = require_context()?;
    let herdr_bin = env_nonempty("HERDR_BIN_PATH")
        .or_else(|| env_nonempty("HERDR_SUBAGENTS_DEFAULT_HERDR"))
        .unwrap_or_else(|| "herdr".to_string());
    let base = env_nonempty("XDG_RUNTIME_DIR")
        .or_else(|| env_nonempty("TMPDIR"))
        .unwrap_or_else(|| "/tmp".to_string());
    let runtime_root = Path::new(&base).join("herdr-subagents");
    let session_key = sha256_prefix(&socket);
    let context_key = sha256_prefix(&format!("{workspace}:{tab}:{pane}"));
    let state_dir = runtime_root.join(session_key);
    let manifest = state_dir.join(format!("{context_key}.json"));
    ensure_private_directory(&runtime_root)?;
    ensure_private_directory(&state_dir)?;
    Ok(Context {
        herdr: Herdr { bin: herdr_bin },
        workspace,
        tab,
        pane,
        cwd: logical_cwd(),
        state_dir,
        manifest,
    })
}

fn path_with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut text = OsString::from(path);
    text.push(suffix);
    PathBuf::from(text)
}

impl Context {
    fn require_manifest(&self) -> Res<Value> {
        let regular = fs::symlink_metadata(&self.manifest).is_ok_and(|meta| meta.is_file());
        if !regular {
            return die("no regular subagent manifest exists for the current pane");
        }
        let belongs = fs::read_to_string(&self.manifest)
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
            .filter(|manifest| {
                manifest.get("workspace_id") == Some(&Value::String(self.workspace.clone()))
                    && manifest.get("tab_id") == Some(&Value::String(self.tab.clone()))
                    && manifest.get("main_pane_id") == Some(&Value::String(self.pane.clone()))
            });
        belongs.map_or_else(
            || die("manifest does not belong to the current Herdr context"),
            Ok,
        )
    }

    fn read_manifest(&self) -> Res<Value> {
        let text = fs::read_to_string(&self.manifest).map_err(|error| Failure {
            code: 1,
            message: Some(format!("{}: {error}", self.manifest.display())),
        })?;
        parse_json(&text, "the manifest")
    }

    /// Writes through a randomized private temporary file and renames it into place.
    fn write_manifest(&self, manifest: &Value) -> Res<()> {
        let content = format!("{}\n", pretty(manifest));
        let hasher_state = RandomState::new();
        let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for _ in 0..100 {
            let mut seed = hasher_state.build_hasher().finish();
            let suffix: String = (0..6)
                .map(|_| {
                    let ch = alphabet[(seed % alphabet.len() as u64) as usize] as char;
                    seed /= alphabet.len() as u64;
                    ch
                })
                .collect();
            let next = path_with_suffix(&self.manifest, &format!(".{suffix}"));
            let file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&next);
            let mut file = match file {
                Ok(file) => file,
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                Err(error) => return die(format!("cannot create {}: {error}", next.display())),
            };
            let result = file
                .write_all(content.as_bytes())
                .and_then(|()| file.flush())
                .and_then(|()| fs::rename(&next, &self.manifest));
            if let Err(error) = result {
                let _ = fs::remove_file(&next);
                return die(format!("cannot write {}: {error}", self.manifest.display()));
            }
            return Ok(());
        }
        die("cannot create a temporary manifest file")
    }

    fn list_panes(&self) -> Res<Value> {
        let text = self
            .herdr
            .capture(&["pane", "list", "--workspace", &self.workspace])?;
        parse_json(&text, "herdr pane list")
    }

    fn show_status(&self) -> Res<()> {
        let mut manifest = self.require_manifest()?;
        let panes = self.list_panes()?;
        let Some(pane_list) = panes
            .pointer("/result/panes")
            .and_then(Value::as_array)
            .cloned()
        else {
            return silent(5);
        };
        let Some(agents) = manifest.get_mut("agents").and_then(Value::as_array_mut) else {
            return silent(5);
        };
        for agent in agents {
            let pane = pane_list.iter().find(|pane| {
                pane.get("pane_id") == agent.get("pane_id")
                    && pane.get("tab_id") == agent.get("tab_id")
            });
            let status = match pane {
                None => json!("exited"),
                Some(pane) => match pane.get("agent_status") {
                    None | Some(Value::Null | Value::Bool(false)) => json!("unknown"),
                    Some(value) => value.clone(),
                },
            };
            if let Some(object) = agent.as_object_mut() {
                object.insert("present".to_string(), json!(pane.is_some()));
                object.insert("status".to_string(), status);
            }
        }
        println!("{}", pretty(&manifest));
        Ok(())
    }
}

#[derive(Default)]
struct Catalogs {
    codex: Option<String>,
    cursor: Option<String>,
}

fn command_exists(name: &str) -> bool {
    let Some(path) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&path).any(|directory| {
        fs::metadata(directory.join(name))
            .is_ok_and(|meta| meta.is_file() && meta.permissions().mode() & 0o111 != 0)
    })
}

fn load_catalog(program: &str, args: &[&str], failure: &str) -> Res<String> {
    let output = Command::new(program)
        .args(args)
        .stderr(Stdio::inherit())
        .output();
    match output {
        Ok(output) if output.status.success() => {
            Ok(trim_newlines(&String::from_utf8_lossy(&output.stdout)).to_string())
        }
        _ => die(failure),
    }
}

struct Resolved {
    kind: &'static str,
    model: String,
    effort: String,
}

impl Catalogs {
    fn latest_codex_model(&mut self, family: &str) -> Res<String> {
        if !command_exists("codex") {
            return die(format!("codex is required for the {family} preset"));
        }
        if self.codex.is_none() {
            self.codex = Some(load_catalog(
                "codex",
                &["debug", "models"],
                "failed to load the Codex model catalog",
            )?);
        }
        let catalog = parse_json(self.codex.as_deref().unwrap_or_default(), "codex")?;
        let Some(models) = catalog.get("models").and_then(Value::as_array) else {
            return silent(5);
        };
        let suffix = format!("-{family}");
        let latest = version::latest(
            models
                .iter()
                .filter_map(|model| model.get("slug").and_then(Value::as_str))
                .filter(|slug| slug.ends_with(&suffix)),
        );
        latest.map_or_else(
            || die(format!("no current Codex {family} model is available")),
            |model| Ok(model.to_string()),
        )
    }

    fn latest_cursor_model(&mut self, family: &str) -> Res<String> {
        if !command_exists("cursor-agent") {
            return die(format!("cursor-agent is required for the {family} preset"));
        }
        if self.cursor.is_none() {
            self.cursor = Some(load_catalog(
                "cursor-agent",
                &["--list-models"],
                "failed to load the Cursor model catalog",
            )?);
        }
        let catalog = self.cursor.as_deref().unwrap_or_default();
        let candidates = catalog
            .lines()
            .filter_map(|line| line.split_whitespace().next())
            .filter(|name| match family {
                "grok" => name
                    .strip_prefix("cursor-grok-")
                    .and_then(|rest| rest.strip_suffix("-high-fast"))
                    .is_some_and(version::is_dotted_number),
                _ => name
                    .strip_prefix("composer-")
                    .is_some_and(version::is_dotted_number),
            });
        version::latest(candidates).map_or_else(
            || die(format!("no current Cursor {family} model is available")),
            |model| Ok(model.to_string()),
        )
    }

    fn resolve(&mut self, preset: &str) -> Res<Resolved> {
        let fixed = |kind, model: &str, effort: &str| Resolved {
            kind,
            model: model.to_string(),
            effort: effort.to_string(),
        };
        Ok(match preset {
            "pi" => fixed("pi", "", ""),
            "astra" => fixed("codex", &self.latest_codex_model("astra")?, "low"),
            "sol" => fixed("codex", &self.latest_codex_model("sol")?, "medium"),
            "luna" => fixed("codex", &self.latest_codex_model("luna")?, "xhigh"),
            "opus" => fixed("claude", "opus", "medium"),
            "fable" => fixed("claude", "fable", "low"),
            "grok" => fixed("cursor", &self.latest_cursor_model("grok")?, ""),
            "composer" => fixed("cursor", &self.latest_cursor_model("composer")?, ""),
            _ => return die(format!("unknown preset: {preset}")),
        })
    }
}

fn valid_agent_name(name: &str) -> bool {
    let bytes = name.as_bytes();
    (1..=32).contains(&bytes.len())
        && bytes[0].is_ascii_lowercase()
        && bytes[1..]
            .iter()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'_' | b'-'))
}

/// Chooses split directions: split the longer visual axis (cells are about twice as tall as wide).
fn split_directions(width: u64, height: u64) -> (&'static str, &'static str) {
    if width >= height * 2 {
        ("right", "down")
    } else {
        ("down", "right")
    }
}

fn split_ratio(total: usize, index: usize) -> String {
    format!("{:.9}", 1.0 / (total - index + 1) as f64)
}

#[derive(Clone)]
struct Agent {
    name: String,
    preset: String,
    kind: &'static str,
    model: String,
    effort: String,
    pane: String,
}

impl Agent {
    fn start_args(&self) -> Vec<String> {
        let mut args: Vec<String> = [
            "agent", "start", &self.name, "--kind", self.kind, "--pane", &self.pane, "--",
        ]
        .map(String::from)
        .to_vec();
        match self.kind {
            "pi" => args.push("--no-session".to_string()),
            "claude" => args.extend([
                "--model".to_string(),
                self.model.clone(),
                "--effort".to_string(),
                self.effort.clone(),
            ]),
            "codex" => args.extend([
                "--model".to_string(),
                self.model.clone(),
                "--config".to_string(),
                format!("model_reasoning_effort=\"{}\"", self.effort),
            ]),
            _ => args.extend(["--model".to_string(), self.model.clone()]),
        }
        args
    }
}

fn error_code(output: &Output) -> String {
    let parsed = serde_json::from_str::<Value>(output.stdout.trim())
        .or_else(|_| serde_json::from_str::<Value>(output.combined().trim()));
    parsed
        .ok()
        .map(|value| raw_or(value.pointer("/error/code"), ""))
        .unwrap_or_default()
}

fn start_agent_with_retry(herdr: &Herdr, agent: &Agent) -> bool {
    let args = agent.start_args();
    let mut last = String::new();
    // Each pane independently waits for its shell/direnv to become ready.
    for _ in 0..150 {
        let output = herdr.run_collecting(&args);
        if output.success {
            return true;
        }
        let code = error_code(&output);
        last = output.combined();
        if code != "agent_pane_busy" {
            break;
        }
        thread::sleep(Duration::from_millis(200));
    }
    eprintln!(
        "herdr-subagents: failed to start {}: {}",
        agent.name,
        trim_newlines(&last)
    );
    false
}

/// State shared with the signal thread so an interrupted start can roll back its panes.
#[derive(Default)]
struct Rollback {
    armed: bool,
    created: Vec<String>,
}

impl Rollback {
    fn run(&mut self, herdr: &Herdr) {
        for pane in self.created.iter().rev() {
            herdr.close_quietly(pane);
        }
        self.created.clear();
        self.armed = false;
    }
}

struct LockGuard(PathBuf);

impl Drop for LockGuard {
    fn drop(&mut self) {
        let _ = fs::remove_dir(&self.0);
    }
}

fn parse_specs(catalogs: &mut Catalogs, specs: &[String]) -> Res<Vec<Agent>> {
    let mut agents: Vec<Agent> = Vec::new();
    for spec in specs {
        let Some((name, preset)) = spec.split_once('=') else {
            return die(format!(
                "invalid agent specification: {spec} (expected NAME=PRESET)"
            ));
        };
        if !valid_agent_name(name) {
            return die(format!("invalid agent name: {name}"));
        }
        if agents.iter().any(|existing| existing.name == name) {
            return die(format!("duplicate agent name: {name}"));
        }
        let resolved = catalogs.resolve(preset)?;
        agents.push(Agent {
            name: name.to_string(),
            preset: preset.to_string(),
            kind: resolved.kind,
            model: resolved.model,
            effort: resolved.effort,
            pane: String::new(),
        });
    }
    Ok(agents)
}

fn pane_id_of(result: &str) -> Res<String> {
    let value = parse_json(result, "herdr pane split")?;
    match value.pointer("/result/pane/pane_id") {
        Some(Value::String(id)) => Ok(id.clone()),
        _ => silent(1),
    }
}

fn layout_dimension(layout: &Value, pane: &str, dimension: &str) -> Res<u64> {
    let found = layout
        .pointer("/result/layout/panes")
        .and_then(Value::as_array)
        .and_then(|panes| {
            panes
                .iter()
                .find(|candidate| candidate.get("pane_id") == Some(&Value::String(pane.into())))
        })
        .and_then(|candidate| candidate.pointer(&format!("/rect/{dimension}")))
        .and_then(Value::as_f64)
        .filter(|value| *value > 0.0);
    found.map_or_else(|| silent(4), |value| Ok(value as u64))
}

fn split_panes(ctx: &Context, agents: &mut [Agent], shared: &Mutex<Rollback>) -> Res<()> {
    let layout = parse_json(
        &ctx.herdr.capture(&["pane", "layout", "--current"])?,
        "herdr pane layout",
    )?;
    let width = layout_dimension(&layout, &ctx.pane, "width")?;
    let height = layout_dimension(&layout, &ctx.pane, "height")?;
    let (main_direction, agent_direction) = split_directions(width, height);
    if let Ok(mut state) = shared.lock() {
        state.armed = true;
    }

    let split = |pane: &str, direction: &str, ratio: &str| -> Res<String> {
        let result = ctx.herdr.capture(&[
            "pane",
            "split",
            "--pane",
            pane,
            "--direction",
            direction,
            "--ratio",
            ratio,
            "--cwd",
            &ctx.cwd,
            "--no-focus",
        ])?;
        let id = pane_id_of(&result)?;
        if let Ok(mut state) = shared.lock() {
            state.created.push(id.clone());
        }
        Ok(id)
    };

    let total = agents.len();
    let mut remaining = split(&ctx.pane, main_direction, "0.5")?;
    agents[0].pane.clone_from(&remaining);
    for (index, agent) in agents.iter_mut().enumerate().skip(1) {
        let ratio = split_ratio(total, index);
        let new_pane = split(&remaining, agent_direction, &ratio)?;
        agent.pane.clone_from(&new_pane);
        remaining = new_pane;
    }

    let agent_values: Vec<Value> = agents
        .iter()
        .map(|agent| {
            json!({
                "name": agent.name,
                "preset": agent.preset,
                "kind": agent.kind,
                "model": agent.model,
                "effort": if agent.effort.is_empty() { Value::Null } else { json!(agent.effort) },
                "pane_id": agent.pane,
                "tab_id": ctx.tab,
                "started": false,
            })
        })
        .collect();
    let mut manifest = Map::new();
    manifest.insert("version".into(), json!(2));
    manifest.insert("state".into(), json!("starting"));
    manifest.insert("workspace_id".into(), json!(ctx.workspace));
    manifest.insert("tab_id".into(), json!(ctx.tab));
    manifest.insert("main_pane_id".into(), json!(ctx.pane));
    manifest.insert("cwd".into(), json!(ctx.cwd));
    manifest.insert("agents".into(), Value::Array(agent_values));
    ctx.write_manifest(&Value::Object(manifest))
}

fn set_state(ctx: &Context, state: &str) -> Res<()> {
    let mut manifest = ctx.read_manifest()?;
    if let Some(object) = manifest.as_object_mut() {
        object.insert("state".into(), json!(state));
    }
    ctx.write_manifest(&manifest)
}

fn mark_started(ctx: &Context, name: &str) -> Res<()> {
    let mut manifest = ctx.read_manifest()?;
    if let Some(agents) = manifest.get_mut("agents").and_then(Value::as_array_mut) {
        for agent in agents {
            if agent.get("name") == Some(&Value::String(name.into()))
                && let Some(object) = agent.as_object_mut()
            {
                object.insert("started".into(), json!(true));
            }
        }
    }
    ctx.write_manifest(&manifest)
}

fn start_agents(ctx: &Context, specs: &[String]) -> Res<()> {
    if specs.is_empty() {
        return die("start requires at least one NAME=PRESET argument");
    }
    if specs.len() > 10 {
        return die("at most 10 subagents are supported");
    }
    // Claim the pane atomically so concurrent starts cannot both pass the manifest check.
    let lock = path_with_suffix(&ctx.manifest, ".lock");
    if fs::DirBuilder::new().mode(0o700).create(&lock).is_err() {
        return die(format!(
            "another start is in progress for the current pane (remove {} if it is stale)",
            lock.display()
        ));
    }
    let _guard = LockGuard(lock.clone());
    if fs::symlink_metadata(&ctx.manifest).is_ok() {
        return die("a subagent manifest already exists; run cleanup first");
    }

    let current = parse_json(
        &ctx.herdr.capture(&["pane", "current", "--current"])?,
        "herdr pane current",
    )?;
    if raw_or(current.pointer("/result/pane/agent"), "") != "pi" {
        return die("the current pane must be running Pi");
    }

    let mut catalogs = Catalogs::default();
    let mut agents = parse_specs(&mut catalogs, specs)?;

    let shared = Arc::new(Mutex::new(Rollback::default()));
    if let Ok(mut signals) = Signals::new([SIGINT, SIGTERM]) {
        let shared = Arc::clone(&shared);
        let herdr = Herdr {
            bin: ctx.herdr.bin.clone(),
        };
        let lock = lock.clone();
        thread::spawn(move || {
            if let Some(signal) = signals.forever().next() {
                if let Ok(mut state) = shared.lock()
                    && state.armed
                {
                    state.run(&herdr);
                }
                let _ = fs::remove_dir(&lock);
                process::exit(if signal == SIGINT { 130 } else { 143 });
            }
        });
    }

    if let Err(failure) = split_panes(ctx, &mut agents, &shared) {
        if let Ok(mut state) = shared.lock() {
            state.run(&ctx.herdr);
        }
        return Err(failure);
    }
    if let Ok(mut state) = shared.lock() {
        state.armed = false;
    }

    let workers: Vec<_> = agents
        .iter()
        .cloned()
        .map(|agent| {
            let herdr = Herdr {
                bin: ctx.herdr.bin.clone(),
            };
            thread::spawn(move || start_agent_with_retry(&herdr, &agent))
        })
        .collect();

    // Only the parent writes the manifest; collect every worker even on failure.
    let mut start_failed = false;
    for (agent, worker) in agents.iter().zip(workers) {
        if worker.join().unwrap_or(false) {
            mark_started(ctx, &agent.name)?;
        } else {
            start_failed = true;
        }
    }

    if start_failed {
        set_state(ctx, "partial")?;
        ctx.show_status()?;
        return die("one or more agents failed to start; panes were preserved");
    }
    set_state(ctx, "awaiting_readiness_check")?;
    ctx.show_status()
}

fn cleanup_agents(ctx: &Context, args: &[String]) -> Res<i32> {
    let mut rest = args;
    let mut force = false;
    if rest.first().map(String::as_str) == Some("--force") {
        force = true;
        rest = &rest[1..];
    }
    if !rest.is_empty() {
        return die("cleanup accepts only --force");
    }
    let manifest = ctx.require_manifest()?;
    let panes = ctx.list_panes()?;
    let Some(pane_list) = panes.pointer("/result/panes").and_then(Value::as_array) else {
        return silent(5);
    };
    let Some(agents) = manifest.get("agents").and_then(Value::as_array) else {
        return silent(5);
    };

    let mut closed: Vec<Value> = Vec::new();
    let mut preserved: Vec<Value> = Vec::new();
    let preserve = |name: &str, pane_id: &str, reason: &str| json!({"name": name, "pane_id": pane_id, "reason": reason});

    for agent in agents {
        let pane_id = raw_or(agent.get("pane_id"), "null");
        let name = raw_or(agent.get("name"), "null");
        let pane = pane_list.iter().find(|pane| {
            pane.get("pane_id") == Some(&Value::String(pane_id.clone()))
                && pane.get("tab_id") == Some(&Value::String(ctx.tab.clone()))
        });
        let Some(pane) = pane else {
            closed.push(json!(pane_id));
            continue;
        };

        let agent_name = raw_or(pane.get("agent"), "");
        let status = raw_or(pane.get("agent_status"), "unknown");
        let started = agent.get("started") == Some(&Value::Bool(true));
        let reason = if !started {
            "start_failed".to_string()
        } else if !agent_name.is_empty() && status != "idle" && status != "done" {
            format!("agent_{status}")
        } else {
            String::new()
        };
        if !force && !reason.is_empty() {
            preserved.push(preserve(&name, &pane_id, &reason));
            continue;
        }

        let output =
            ctx.herdr
                .run_collecting(&["pane".to_string(), "close".to_string(), pane_id.clone()]);
        if output.success {
            closed.push(json!(pane_id));
        } else {
            preserved.push(preserve(&name, &pane_id, "close_failed"));
            eprintln!(
                "herdr-subagents: failed to close {pane_id}: {}",
                trim_newlines(&output.combined())
            );
        }
    }

    println!(
        "{}",
        pretty(&json!({"closed": closed, "preserved": preserved}))
    );

    if preserved.is_empty() {
        let _ = fs::remove_file(&ctx.manifest);
        let _ = fs::remove_dir(&ctx.state_dir);
        Ok(0)
    } else {
        Ok(1)
    }
}

fn run(args: &[String]) -> Res<i32> {
    let ctx = init_context()?;
    let Some(command) = args.first().filter(|command| !command.is_empty()) else {
        print!("{USAGE}");
        return Ok(2);
    };
    let rest = &args[1..];
    match command.as_str() {
        "start" => start_agents(&ctx, rest).map(|()| 0),
        "status" => {
            if !rest.is_empty() {
                return die("status does not accept arguments");
            }
            ctx.show_status().map(|()| 0)
        }
        "cleanup" => cleanup_agents(&ctx, rest),
        "-h" | "--help" | "help" => {
            print!("{USAGE}");
            Ok(0)
        }
        _ => {
            eprint!("{USAGE}");
            Ok(2)
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let code = match run(&args) {
        Ok(code) => code,
        Err(failure) => {
            if let Some(message) = failure.message {
                eprintln!("herdr-subagents: {message}");
            }
            failure.code
        }
    };
    process::exit(code);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agent_names() {
        assert!(valid_agent_name("analyst"));
        assert!(valid_agent_name("a_b-9"));
        assert!(valid_agent_name(&"a".repeat(32)));
        assert!(!valid_agent_name(&"a".repeat(33)));
        assert!(!valid_agent_name(""));
        assert!(!valid_agent_name("1abc"));
        assert!(!valid_agent_name("Abc"));
        assert!(!valid_agent_name("a.b"));
    }

    #[test]
    fn split_geometry() {
        assert_eq!(split_directions(120, 30), ("right", "down"));
        assert_eq!(split_directions(60, 30), ("right", "down"));
        assert_eq!(split_directions(59, 30), ("down", "right"));
        assert_eq!(split_ratio(3, 1), "0.333333333");
        assert_eq!(split_ratio(4, 1), "0.250000000");
        assert_eq!(split_ratio(4, 3), "0.500000000");
    }

    #[test]
    fn jq_style_rendering() {
        assert_eq!(raw(&json!("x")), "x");
        assert_eq!(raw(&Value::Null), "null");
        assert_eq!(raw_or(None, "d"), "d");
        assert_eq!(raw_or(Some(&json!(false)), "d"), "d");
        assert_eq!(raw_or(Some(&json!("idle")), "d"), "idle");
    }

    #[test]
    fn start_commands() {
        let agent = |kind, model: &str, effort: &str| Agent {
            name: "n".into(),
            preset: "p".into(),
            kind,
            model: model.into(),
            effort: effort.into(),
            pane: "pane-1".into(),
        };
        let base = ["agent", "start", "n", "--kind"];
        assert_eq!(
            agent("pi", "", "").start_args(),
            [
                base[0],
                base[1],
                base[2],
                base[3],
                "pi",
                "--pane",
                "pane-1",
                "--",
                "--no-session"
            ]
        );
        assert_eq!(
            agent("codex", "gpt-sol", "low").start_args()[8..],
            [
                "--model",
                "gpt-sol",
                "--config",
                "model_reasoning_effort=\"low\""
            ]
        );
        assert_eq!(
            agent("claude", "opus", "medium").start_args()[8..],
            ["--model", "opus", "--effort", "medium"]
        );
        assert_eq!(
            agent("cursor", "composer-2", "").start_args()[8..],
            ["--model", "composer-2"]
        );
    }

    #[test]
    fn sha_prefix_is_sixteen_hex_digits() {
        assert_eq!(sha256_prefix(""), "e3b0c44298fc1c14");
    }
}
