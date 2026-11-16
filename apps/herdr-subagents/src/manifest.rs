use crate::error::{Error, JQ_RUNTIME_ERROR, Result};
use crate::json;
use crate::session::Session;
use dot::json::{Map, Value, json};

pub struct Manifest(Value);

impl Manifest {
    pub fn starting(session: &Session, agents: Vec<Value>) -> Self {
        let mut manifest = Map::new();
        manifest.insert("version".into(), json!(2));
        manifest.insert("state".into(), json!("starting"));
        manifest.insert("workspace_id".into(), json!(session.workspace));
        manifest.insert("tab_id".into(), json!(session.tab));
        manifest.insert("main_pane_id".into(), json!(session.pane));
        manifest.insert("cwd".into(), json!(session.cwd));
        manifest.insert("agents".into(), Value::Array(agents));
        Self(Value::Object(manifest))
    }

    pub fn parse(text: &str) -> Result<Self> {
        json::parse(text, "the manifest").map(Self)
    }

    pub fn belongs_to(&self, session: &Session) -> bool {
        let field =
            |name: &str, expected: &str| self.0.get(name).and_then(Value::as_str) == Some(expected);
        field("workspace_id", &session.workspace)
            && field("tab_id", &session.tab)
            && field("main_pane_id", &session.pane)
    }

    pub fn agents(&self) -> Result<&Vec<Value>> {
        self.0
            .get("agents")
            .and_then(Value::as_array)
            .ok_or(Error::Exit(JQ_RUNTIME_ERROR))
    }

    pub fn agents_mut(&mut self) -> Result<&mut Vec<Value>> {
        self.0
            .get_mut("agents")
            .and_then(Value::as_array_mut)
            .ok_or(Error::Exit(JQ_RUNTIME_ERROR))
    }

    pub fn set_state(&mut self, state: &str) {
        if let Some(object) = self.0.as_object_mut() {
            object.insert("state".into(), json!(state));
        }
    }

    pub fn mark_started(&mut self, name: &str) {
        let Ok(agents) = self.agents_mut() else {
            return;
        };
        for agent in agents
            .iter_mut()
            .filter(|agent| agent.get("name").and_then(Value::as_str) == Some(name))
        {
            if let Some(object) = agent.as_object_mut() {
                object.insert("started".into(), json!(true));
            }
        }
    }

    pub fn to_file_content(&self) -> String {
        format!("{}\n", json::pretty(&self.0))
    }

    pub fn into_value(self) -> Value {
        self.0
    }
}
