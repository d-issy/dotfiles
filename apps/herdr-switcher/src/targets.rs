use dot::json::Value;
use std::collections::BTreeSet;
use std::path::Path;

pub struct Workspace {
    pub id: String,
    label: String,
    repo_path: Option<String>,
    checkout_path: Option<String>,
    pub has_repo_token: bool,
}

impl Workspace {
    pub fn matches_repo(&self, path: &str) -> bool {
        self.repo_path.as_deref() == Some(path) || self.checkout_path.as_deref() == Some(path)
    }
}

pub fn workspaces(value: &Value) -> Vec<Workspace> {
    value
        .pointer("/result/workspaces")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|value| {
            let id = value.get("workspace_id")?.as_str()?.to_string();
            if id.is_empty() {
                return None;
            }
            let token = value.pointer("/tokens/dot_repo_path");
            Some(Workspace {
                id,
                label: value
                    .get("label")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_string(),
                repo_path: token.and_then(Value::as_str).map(str::to_string),
                checkout_path: value
                    .pointer("/worktree/checkout_path")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                has_repo_token: token.is_some_and(|value| !value.is_null()),
            })
        })
        .collect()
}

pub fn has_pane_cwd(value: &Value, path: &str) -> bool {
    value
        .pointer("/result/panes")
        .and_then(Value::as_array)
        .is_some_and(|panes| {
            panes
                .iter()
                .any(|pane| pane.get("cwd").and_then(Value::as_str) == Some(path))
        })
}

fn tsv(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\t', "\\t")
        .replace('\r', "\\r")
        .replace('\n', "\\n")
}

pub fn workspace_rows(workspaces: &[Workspace]) -> String {
    workspaces
        .iter()
        .map(|workspace| {
            format!(
                "workspace\t{}\t{}\n",
                tsv(&workspace.id),
                tsv(&workspace.label)
            )
        })
        .collect()
}

pub fn repos(list: &str, include_parents: bool) -> String {
    let mut paths = BTreeSet::new();
    for path in list.lines().filter(|line| !line.is_empty()) {
        paths.insert(path.to_string());
        if include_parents {
            let parent = Path::new(path)
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty());
            if let Some(parent) = parent {
                paths.insert(parent.to_string_lossy().into_owned());
            }
        }
    }
    paths
        .into_iter()
        .map(|path| {
            let label = Path::new(&path)
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("/");
            format!("repo\t{path}\t{path}\t{label}\n")
        })
        .collect()
}

#[derive(Debug, PartialEq, Eq)]
pub enum Selection {
    Workspace(String),
    Repo { path: String, label: String },
}

impl Selection {
    pub fn parse(output: &str) -> Option<Self> {
        let mut fields = output.trim_end_matches('\n').splitn(4, '\t');
        let kind = fields.next()?;
        let value = fields.next()?.to_string();
        if value.is_empty() {
            return None;
        }
        match kind {
            "workspace" => Some(Self::Workspace(value)),
            "repo" => {
                fields.next();
                Some(Self::Repo {
                    path: value,
                    label: fields.next().unwrap_or("").to_string(),
                })
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use dot::json;

    #[test]
    fn repo_candidates_are_unique_and_optionally_include_parents() {
        let input = "/code/org/b\n/code/org/a\n/code/org/b\n\n";
        assert_eq!(
            repos(input, true),
            "repo\t/code/org\t/code/org\torg\nrepo\t/code/org/a\t/code/org/a\ta\nrepo\t/code/org/b\t/code/org/b\tb\n"
        );
        assert_eq!(repos("/code/a\n", false), "repo\t/code/a\t/code/a\ta\n");
    }

    #[test]
    fn parses_workspaces_and_escapes_tsv_like_jq() {
        let value = json::from_str(
            r#"{"result":{"workspaces":[
            {"workspace_id":"w1","label":"a\tb\nc\\d","tokens":{"dot_repo_path":"/repo"}},
            {"workspace_id":"w2","worktree":{"checkout_path":"/checkout"}},
            {"workspace_id":"w3","tokens":{"dot_repo_path":null}},
            {"label":"missing id"}
        ]}}"#,
        )
        .unwrap();
        let workspaces = workspaces(&value);
        assert_eq!(workspaces.len(), 3);
        assert!(workspaces[0].matches_repo("/repo"));
        assert!(workspaces[0].has_repo_token);
        assert!(workspaces[1].matches_repo("/checkout"));
        assert!(!workspaces[1].has_repo_token);
        assert!(!workspaces[2].has_repo_token);
        assert_eq!(
            workspace_rows(&workspaces),
            "workspace\tw1\ta\\tb\\nc\\\\d\nworkspace\tw2\t\nworkspace\tw3\t\n"
        );
    }

    #[test]
    fn selects_only_known_nonempty_targets() {
        assert_eq!(Selection::parse(""), None);
        assert_eq!(Selection::parse("repo\t\tlabel"), None);
        assert_eq!(Selection::parse("unknown\tvalue"), None);
        assert_eq!(
            Selection::parse("workspace\tw1\tlabel\n"),
            Some(Selection::Workspace("w1".into()))
        );
        assert_eq!(
            Selection::parse("repo\t/a b\t/a b\ta b\n"),
            Some(Selection::Repo {
                path: "/a b".into(),
                label: "a b".into()
            })
        );
    }

    #[test]
    fn missing_lists_are_empty_and_pane_cwd_must_match_exactly() {
        assert!(workspaces(&Value::Null).is_empty());
        let panes = json::from_str(r#"{"result":{"panes":[{"cwd":"/repo"}]}}"#).unwrap();
        assert!(has_pane_cwd(&panes, "/repo"));
        assert!(!has_pane_cwd(&panes, "/repo-other"));
        assert!(!has_pane_cwd(&Value::Null, "/repo"));
    }
}
