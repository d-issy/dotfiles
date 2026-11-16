use crate::error::Result;
use crate::json;
use crate::session::Session;
use dot::json::{Value, json};

pub fn show(session: &Session) -> Result<()> {
    let mut manifest = session.require_manifest()?;
    let panes = session.list_panes()?;
    for agent in manifest.agents_mut()? {
        let pane = panes.iter().find(|pane| {
            pane.get("pane_id") == agent.get("pane_id") && pane.get("tab_id") == agent.get("tab_id")
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
    println!("{}", json::pretty(&manifest.into_value()));
    Ok(())
}
