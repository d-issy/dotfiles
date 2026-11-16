use crate::error::Result;
use crate::herdr::trim_newlines;
use crate::json::{self, raw_or};
use crate::session::Session;
use serde_json::{Value, json};
use std::fmt;

enum PreserveReason {
    StartFailed,
    Agent(String),
    CloseFailed,
}

impl fmt::Display for PreserveReason {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::StartFailed => f.write_str("start_failed"),
            Self::Agent(status) => write!(f, "agent_{status}"),
            Self::CloseFailed => f.write_str("close_failed"),
        }
    }
}

struct Preserved {
    name: String,
    pane_id: String,
    reason: PreserveReason,
}

impl Preserved {
    fn to_json(&self) -> Value {
        json!({"name": self.name, "pane_id": self.pane_id, "reason": self.reason.to_string()})
    }
}

fn preserve_reason(started: bool, agent_name: &str, status: &str) -> Option<PreserveReason> {
    if !started {
        Some(PreserveReason::StartFailed)
    } else if !agent_name.is_empty() && status != "idle" && status != "done" {
        Some(PreserveReason::Agent(status.to_string()))
    } else {
        None
    }
}

/// Returns the process exit status: 1 while any pane had to be preserved.
pub fn run(session: &Session, force: bool) -> Result<i32> {
    let manifest = session.require_manifest()?;
    let panes = session.list_panes()?;
    let agents = manifest.agents()?;

    let mut closed: Vec<String> = Vec::new();
    let mut preserved: Vec<Preserved> = Vec::new();

    for agent in agents {
        let pane_id = raw_or(agent.get("pane_id"), "null");
        let name = raw_or(agent.get("name"), "null");
        let pane = panes.iter().find(|pane| {
            pane.get("pane_id").and_then(Value::as_str) == Some(pane_id.as_str())
                && pane.get("tab_id").and_then(Value::as_str) == Some(session.tab.as_str())
        });
        let Some(pane) = pane else {
            closed.push(pane_id);
            continue;
        };

        let agent_name = raw_or(pane.get("agent"), "");
        let status = raw_or(pane.get("agent_status"), "unknown");
        let started = agent.get("started") == Some(&Value::Bool(true));
        if !force && let Some(reason) = preserve_reason(started, &agent_name, &status) {
            preserved.push(Preserved {
                name,
                pane_id,
                reason,
            });
            continue;
        }

        let output = session.herdr.run(&["pane", "close", &pane_id]);
        if output.success {
            closed.push(pane_id);
        } else {
            eprintln!(
                "herdr-subagents: failed to close {pane_id}: {}",
                trim_newlines(&output.combined())
            );
            preserved.push(Preserved {
                name,
                pane_id,
                reason: PreserveReason::CloseFailed,
            });
        }
    }

    let preserved_json: Vec<Value> = preserved.iter().map(Preserved::to_json).collect();
    println!(
        "{}",
        json::pretty(&json!({"closed": closed, "preserved": preserved_json}))
    );

    if preserved.is_empty() {
        session.discard_manifest();
        Ok(0)
    } else {
        Ok(1)
    }
}
