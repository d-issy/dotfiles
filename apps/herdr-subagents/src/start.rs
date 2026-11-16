use crate::error::{Error, JQ_NO_OUTPUT, JQ_NULL_RESULT, Result, die};
use crate::fsutil::create_private_dir;
use crate::herdr::{Herdr, trim_newlines};
use crate::interrupt::{self, Rollback};
use crate::json::{self, raw_or};
use crate::manifest::Manifest;
use crate::preset::{Catalogs, Launch, Preset};
use crate::session::Session;
use crate::status;
use serde_json::{Value, json};
use std::fmt;
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;
use std::thread;
use std::time::Duration;

const MAX_AGENTS: usize = 10;
const START_ATTEMPTS: usize = 150;
const START_RETRY_DELAY: Duration = Duration::from_millis(200);

struct LockGuard(PathBuf);

impl Drop for LockGuard {
    fn drop(&mut self) {
        let _ = fs::remove_dir(&self.0);
    }
}

#[derive(Debug, PartialEq, Eq)]
struct AgentName(String);

impl FromStr for AgentName {
    type Err = Error;

    fn from_str(name: &str) -> Result<Self> {
        let bytes = name.as_bytes();
        let valid = (1..=32).contains(&bytes.len())
            && bytes[0].is_ascii_lowercase()
            && bytes[1..]
                .iter()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || matches!(b, b'_' | b'-'));
        if valid {
            Ok(Self(name.to_string()))
        } else {
            die(format!("invalid agent name: {name}"))
        }
    }
}

/// `NAME=PRESET`; the preset stays textual so duplicate names are reported before unknown presets.
struct Spec {
    name: AgentName,
    preset: String,
}

impl FromStr for Spec {
    type Err = Error;

    fn from_str(spec: &str) -> Result<Self> {
        let Some((name, preset)) = spec.split_once('=') else {
            return die(format!(
                "invalid agent specification: {spec} (expected NAME=PRESET)"
            ));
        };
        Ok(Self {
            name: name.parse()?,
            preset: preset.to_string(),
        })
    }
}

struct Agent {
    name: String,
    preset: Preset,
    launch: Launch,
}

impl Agent {
    fn start_args(&self, pane: &str) -> Vec<String> {
        let mut args: Vec<String> = [
            "agent",
            "start",
            &self.name,
            "--kind",
            self.launch.kind(),
            "--pane",
            pane,
            "--",
        ]
        .map(String::from)
        .to_vec();
        args.extend(self.launch.agent_args());
        args
    }

    fn manifest_entry(&self, pane: &str, tab: &str) -> Value {
        json!({
            "name": self.name,
            "preset": self.preset.to_string(),
            "kind": self.launch.kind(),
            "model": self.launch.model(),
            "effort": self.launch.effort(),
            "pane_id": pane,
            "tab_id": tab,
            "started": false,
        })
    }
}

fn parse_agents(specs: &[String]) -> Result<Vec<Agent>> {
    let mut catalogs = Catalogs::default();
    let mut agents: Vec<Agent> = Vec::new();
    for spec in specs {
        let Spec { name, preset } = spec.parse()?;
        if agents.iter().any(|existing| existing.name == name.0) {
            return die(format!("duplicate agent name: {}", name.0));
        }
        let preset: Preset = preset.parse()?;
        agents.push(Agent {
            name: name.0,
            preset,
            launch: catalogs.resolve(preset)?,
        });
    }
    Ok(agents)
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Direction {
    Right,
    Down,
}

impl fmt::Display for Direction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Right => "right",
            Self::Down => "down",
        })
    }
}

#[derive(Debug, PartialEq, Eq)]
struct SplitPlan {
    main: Direction,
    agents: Direction,
}

impl SplitPlan {
    /// Terminal cells are about twice as tall as wide: split the longer visual axis,
    /// then divide the agent half perpendicularly.
    fn for_size(width: u64, height: u64) -> Self {
        if width >= height * 2 {
            Self {
                main: Direction::Right,
                agents: Direction::Down,
            }
        } else {
            Self {
                main: Direction::Down,
                agents: Direction::Right,
            }
        }
    }
}

fn split_ratio(total: usize, index: usize) -> String {
    format!("{:.9}", 1.0 / (total - index + 1) as f64)
}

fn pane_dimension(layout: &Value, pane: &str, dimension: &str) -> Result<u64> {
    layout
        .pointer("/result/layout/panes")
        .and_then(Value::as_array)
        .and_then(|panes| {
            panes
                .iter()
                .find(|candidate| candidate.get("pane_id").and_then(Value::as_str) == Some(pane))
        })
        .and_then(|candidate| candidate.pointer(&format!("/rect/{dimension}")))
        .and_then(Value::as_f64)
        .filter(|value| *value > 0.0)
        .map(|value| value as u64)
        .ok_or(Error::Exit(JQ_NO_OUTPUT))
}

fn split(
    session: &Session,
    rollback: &Rollback,
    pane: &str,
    direction: Direction,
    ratio: &str,
) -> Result<String> {
    let result = session.herdr.capture(&[
        "pane",
        "split",
        "--pane",
        pane,
        "--direction",
        &direction.to_string(),
        "--ratio",
        ratio,
        "--cwd",
        &session.cwd,
        "--no-focus",
    ])?;
    let id = json::parse(&result, "herdr pane split")?
        .pointer("/result/pane/pane_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or(Error::Exit(JQ_NULL_RESULT))?;
    rollback.record(&id);
    Ok(id)
}

fn create_panes(
    session: &Session,
    rollback: &Rollback,
    agents: &[Agent],
    plan: &SplitPlan,
) -> Result<Vec<String>> {
    rollback.arm();
    let mut panes = vec![split(session, rollback, &session.pane, plan.main, "0.5")?];
    for index in 1..agents.len() {
        let remaining = panes.last().map_or(session.pane.as_str(), String::as_str);
        let ratio = split_ratio(agents.len(), index);
        let next = split(session, rollback, remaining, plan.agents, &ratio)?;
        panes.push(next);
    }
    let entries = agents
        .iter()
        .zip(&panes)
        .map(|(agent, pane)| agent.manifest_entry(pane, &session.tab))
        .collect();
    session.write_manifest(&Manifest::starting(session, entries))?;
    Ok(panes)
}

fn start_with_retry(herdr: &Herdr, agent: &Agent, pane: &str) -> bool {
    let args = agent.start_args(pane);
    let mut last_output = String::new();
    // Each pane independently waits for its shell/direnv to become ready.
    for _ in 0..START_ATTEMPTS {
        let output = herdr.run(&args);
        if output.success {
            return true;
        }
        let error_code = serde_json::from_str::<Value>(output.stdout.trim())
            .or_else(|_| serde_json::from_str::<Value>(output.combined().trim()))
            .map(|value| raw_or(value.pointer("/error/code"), ""))
            .unwrap_or_default();
        last_output = output.combined();
        if error_code != "agent_pane_busy" {
            break;
        }
        thread::sleep(START_RETRY_DELAY);
    }
    eprintln!(
        "herdr-subagents: failed to start {}: {}",
        agent.name,
        trim_newlines(&last_output)
    );
    false
}

fn start_all(session: &Session, agents: &[Agent], panes: &[String]) -> Result<bool> {
    thread::scope(|scope| {
        let workers: Vec<_> = agents
            .iter()
            .zip(panes)
            .map(|(agent, pane)| scope.spawn(|| start_with_retry(&session.herdr, agent, pane)))
            .collect();

        // Only the parent writes the manifest; collect every worker even on failure.
        let mut any_failed = false;
        for (agent, worker) in agents.iter().zip(workers) {
            if worker.join().unwrap_or(false) {
                let mut manifest = session.read_manifest()?;
                manifest.mark_started(&agent.name);
                session.write_manifest(&manifest)?;
            } else {
                any_failed = true;
            }
        }
        Ok(any_failed)
    })
}

fn set_state(session: &Session, state: &str) -> Result<()> {
    let mut manifest = session.read_manifest()?;
    manifest.set_state(state);
    session.write_manifest(&manifest)
}

pub fn run(session: &Session, specs: &[String]) -> Result<()> {
    if specs.is_empty() {
        return die("start requires at least one NAME=PRESET argument");
    }
    if specs.len() > MAX_AGENTS {
        return die(format!("at most {MAX_AGENTS} subagents are supported"));
    }
    // Claim the pane atomically so concurrent starts cannot both pass the manifest check.
    let lock = session.lock_path();
    if create_private_dir(&lock).is_err() {
        return die(format!(
            "another start is in progress for the current pane (remove {} if it is stale)",
            lock.display()
        ));
    }
    let _lock = LockGuard(lock.clone());
    if session.manifest_exists() {
        return die("a subagent manifest already exists; run cleanup first");
    }

    let current = json::parse(
        &session.herdr.capture(&["pane", "current", "--current"])?,
        "herdr pane current",
    )?;
    if raw_or(current.pointer("/result/pane/agent"), "") != "pi" {
        return die("the current pane must be running Pi");
    }

    let layout = json::parse(
        &session.herdr.capture(&["pane", "layout", "--current"])?,
        "herdr pane layout",
    )?;
    let plan = SplitPlan::for_size(
        pane_dimension(&layout, &session.pane, "width")?,
        pane_dimension(&layout, &session.pane, "height")?,
    );

    let agents = parse_agents(specs)?;

    let rollback = Rollback::default();
    interrupt::install_handlers(rollback.clone(), session.herdr.clone(), lock);
    let panes = create_panes(session, &rollback, &agents, &plan).inspect_err(|_| {
        rollback.run(&session.herdr);
    })?;
    rollback.disarm();

    if start_all(session, &agents, &panes)? {
        set_state(session, "partial")?;
        status::show(session)?;
        return die("one or more agents failed to start; panes were preserved");
    }
    set_state(session, "awaiting_readiness_check")?;
    status::show(session)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agent_names() {
        for valid in ["analyst", "a_b-9", &"a".repeat(32)] {
            assert!(valid.parse::<AgentName>().is_ok(), "{valid}");
        }
        for invalid in [&"a".repeat(33), "", "1abc", "Abc", "a.b"] {
            assert!(invalid.parse::<AgentName>().is_err(), "{invalid}");
        }
    }

    #[test]
    fn specs() {
        let spec: Spec = "a=b=c".parse().unwrap();
        assert_eq!(
            (spec.name, spec.preset.as_str()),
            (AgentName("a".into()), "b=c")
        );
        assert_eq!(
            "ab".parse::<Spec>().err().unwrap().to_string(),
            "invalid agent specification: ab (expected NAME=PRESET)"
        );
    }

    #[test]
    fn split_geometry() {
        let right = SplitPlan {
            main: Direction::Right,
            agents: Direction::Down,
        };
        let down = SplitPlan {
            main: Direction::Down,
            agents: Direction::Right,
        };
        assert_eq!(SplitPlan::for_size(120, 30), right);
        assert_eq!(SplitPlan::for_size(60, 30), right);
        assert_eq!(SplitPlan::for_size(59, 30), down);
        assert_eq!(split_ratio(3, 1), "0.333333333");
        assert_eq!(split_ratio(4, 1), "0.250000000");
        assert_eq!(split_ratio(4, 3), "0.500000000");
    }

    #[test]
    fn start_commands() {
        let agent = Agent {
            name: "n".into(),
            preset: Preset::Pi,
            launch: Launch::Pi,
        };
        assert_eq!(
            agent.start_args("pane-1"),
            [
                "agent",
                "start",
                "n",
                "--kind",
                "pi",
                "--pane",
                "pane-1",
                "--",
                "--no-session"
            ]
        );
    }
}
