use crate::context::Context;
use crate::process::CommandExt;
use crate::shell::bash_read_tab_fields;

const PARALLEL_CHECKS: usize = 4;

impl Context {
    fn upstream_gone(&self, branch: &str) -> bool {
        self.git([
            "for-each-ref",
            "--format=%(upstream:track)",
            &format!("refs/heads/{branch}"),
        ])
        .discard_stderr()
        .stdout_text()
            == "[gone]"
    }

    /// `git cherry` lists the branch's commits and none is missing from `base`.
    fn patches_in(&self, base: &str, branch: &str) -> bool {
        let cherry = self
            .git(["cherry", base, branch])
            .discard_stderr()
            .stdout_text();
        !cherry.is_empty()
            && !cherry
                .lines()
                .any(|line| line.split_whitespace().next() == Some("+"))
    }

    /// GitHub reports the branch's PR merged at the branch's current tip,
    /// which catches squash merges.
    fn github_pr_merged(&self, branch: &str) -> bool {
        let info = self
            .gh([
                "pr",
                "view",
                branch,
                "--json",
                "state,headRefOid",
                "--jq",
                "[.state, .headRefOid] | @tsv",
            ])
            .discard_stderr()
            .stdout_text();
        let Some(first_line) = info.lines().next() else {
            return false;
        };
        let [state, head_oid] = bash_read_tab_fields::<2>(first_line);
        state == "MERGED" && !head_oid.is_empty() && self.commit_of(branch) == head_oid
    }

    /// A branch `create` made that nobody committed to is not merged, even
    /// though its tip is an ancestor of the base.
    fn never_moved(&self, branch: &str) -> bool {
        let base = self.config_value(&format!("branch.{branch}.worktreeBase"));
        !base.is_empty() && self.commit_of(&format!("refs/heads/{branch}")) == base
    }

    fn is_merged(&self, base: &str, branch: &str) -> bool {
        if self
            .git(["merge-base", "--is-ancestor", branch, base])
            .succeeds()
        {
            !self.never_moved(branch)
        } else {
            self.upstream_gone(branch)
                && (self.patches_in(base, branch) || self.github_pr_merged(branch))
        }
    }

    pub fn merged_branches(&self, base: &str) -> Vec<String> {
        let refs = self
            .git(["for-each-ref", "--format=%(refname:short)", "refs/heads"])
            .stdout_text();
        let branches: Vec<&str> = refs.lines().filter(|line| !line.is_empty()).collect();
        branches
            .chunks(PARALLEL_CHECKS)
            .flat_map(|batch| {
                let merged: Vec<bool> = std::thread::scope(|scope| {
                    batch
                        .iter()
                        .map(|branch| scope.spawn(move || self.is_merged(base, branch)))
                        .collect::<Vec<_>>()
                        .into_iter()
                        .map(|handle| handle.join().unwrap_or(false))
                        .collect()
                });
                batch
                    .iter()
                    .zip(merged)
                    .filter(|(_, merged)| *merged)
                    .map(|(branch, _)| (*branch).to_string())
                    .collect::<Vec<_>>()
            })
            .collect()
    }
}
