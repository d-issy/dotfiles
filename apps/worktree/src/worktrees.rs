use crate::context::Context;
use crate::process::CommandExt;
use crate::shell::bash_read_tab_fields;

const DETACHED: &str = "detached";
const NO_WINDOW: &str = "-";

#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct PorcelainEntry {
    path: String,
    head_ref: Option<String>,
    locked: bool,
}

fn parse_porcelain(listing: &str) -> Vec<PorcelainEntry> {
    let mut entries: Vec<PorcelainEntry> = Vec::new();
    for line in listing.lines() {
        if let Some(path) = line.strip_prefix("worktree ") {
            entries.push(PorcelainEntry {
                path: path.to_string(),
                ..PorcelainEntry::default()
            });
        } else if let Some(entry) = entries.last_mut() {
            if let Some(head_ref) = line.strip_prefix("branch ") {
                entry.head_ref = Some(head_ref.to_string());
            } else if line == "locked" || line.starts_with("locked ") {
                entry.locked = true;
            }
        }
    }
    entries
}

/// A branch label as the shell version printed it: `detached` means no branch.
pub fn branch_from_label(label: &str) -> Option<String> {
    (!label.is_empty() && label != DETACHED).then(|| label.to_string())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Worktree {
    pub branch: Option<String>,
    pub path: String,
}

impl Worktree {
    pub fn branch_label(&self) -> &str {
        self.branch.as_deref().unwrap_or(DETACHED)
    }

    pub fn tsv_line(&self) -> String {
        format!("{}\t{}", self.branch_label(), self.path)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Record {
    pub worktree: Worktree,
    pub window: Option<String>,
    pub managed: bool,
}

impl Record {
    pub fn from_tsv_line(line: &str) -> Self {
        let [branch, window, managed, path] = bash_read_tab_fields::<4>(line);
        Self {
            worktree: Worktree {
                branch: branch_from_label(&branch),
                path,
            },
            window: (window != NO_WINDOW).then_some(window),
            managed: managed == "yes",
        }
    }

    pub fn window_label(&self) -> &str {
        self.window.as_deref().unwrap_or(NO_WINDOW)
    }

    pub fn managed_label(&self) -> &str {
        if self.managed { "yes" } else { "no" }
    }

    pub fn tsv_line(&self) -> String {
        format!(
            "{}\t{}\t{}\t{}",
            self.worktree.branch_label(),
            self.window_label(),
            self.managed_label(),
            self.worktree.path
        )
    }
}

impl Context {
    fn porcelain_entries(&self) -> Vec<PorcelainEntry> {
        parse_porcelain(&self.git(["worktree", "list", "--porcelain"]).stdout_text())
    }

    pub fn worktrees(&self) -> Vec<Worktree> {
        self.porcelain_entries()
            .into_iter()
            .map(|entry| Worktree {
                branch: entry
                    .head_ref
                    .as_deref()
                    .and_then(|head_ref| head_ref.strip_prefix("refs/heads/"))
                    .filter(|branch| !branch.is_empty())
                    .map(str::to_string),
                path: entry.path,
            })
            .collect()
    }

    pub fn branch_checked_out_path(&self, branch: &str) -> Option<String> {
        let head_ref = format!("refs/heads/{branch}");
        self.porcelain_entries()
            .into_iter()
            .find(|entry| entry.head_ref.as_deref() == Some(head_ref.as_str()))
            .map(|entry| entry.path)
    }

    pub fn worktree_locked(&self, path: &str) -> bool {
        self.porcelain_entries()
            .iter()
            .any(|entry| entry.locked && entry.path == path)
    }

    pub fn records(&self) -> Vec<Record> {
        let main_root = self.realpath(&self.managed_repo_root());
        self.worktrees()
            .iter()
            .map(|worktree| {
                let [branch, path] = bash_read_tab_fields::<2>(&worktree.tsv_line());
                let worktree = Worktree {
                    branch: branch_from_label(&branch),
                    path,
                };
                let managed =
                    worktree.branch.is_some() && self.realpath(&worktree.path) != main_root;
                let window = self
                    .window_name_for_path(&worktree.path)
                    .filter(|name| !name.is_empty());
                Record {
                    worktree,
                    window,
                    managed,
                }
            })
            .collect()
    }

    pub fn managed_records(&self) -> Vec<Record> {
        self.records()
            .into_iter()
            .filter(|record| record.managed)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn porcelain_entries() {
        let listing = "worktree /r\nHEAD abc\nbranch refs/heads/main\n\nworktree /d\nHEAD def\ndetached\n\nworktree /l\nbranch refs/heads/x\nlocked keep\n";
        let entries = parse_porcelain(listing);
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].head_ref.as_deref(), Some("refs/heads/main"));
        assert_eq!(entries[1].head_ref, None);
        assert!(entries[2].locked && !entries[0].locked);
    }

    #[test]
    fn record_round_trip() {
        let line = "feature\t-\tyes\t/repo.feature";
        let record = Record::from_tsv_line(line);
        assert_eq!(record.worktree.branch.as_deref(), Some("feature"));
        assert_eq!(record.window, None);
        assert_eq!(record.tsv_line(), line);
    }
}
