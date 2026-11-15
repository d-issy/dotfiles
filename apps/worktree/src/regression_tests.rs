//! Regression tests for internals the CLI cannot reach directly; the
//! end-to-end scenarios live in tests/shell/worktree.sh.

use std::path::{Path, PathBuf};
use std::process::Command;

use crate::common::{Ctx, TempDir};
use crate::config::Config;
use crate::delete::branch_unique_commits;
use crate::prune::{list_prune_branches, remove_prune_worktree};
use crate::repo::{add_worktree_branch, default_base_ref};

fn git(dir: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .current_dir(dir)
        .args(args)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_SYSTEM", "/dev/null")
        .env("GIT_AUTHOR_NAME", "Audit")
        .env("GIT_COMMITTER_NAME", "Audit")
        .env("GIT_AUTHOR_EMAIL", "audit@example.test")
        .env("GIT_COMMITTER_EMAIL", "audit@example.test")
        .output()
        .expect("run git");
    assert!(
        output.status.success(),
        "git {args:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout)
        .trim_end()
        .to_string()
}

struct Fixture {
    _root: TempDir,
    base: PathBuf,
    repo: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = TempDir::new().unwrap_or_else(|_| panic!("temp dir"));
        let base = std::fs::canonicalize(root.path()).expect("canonical temp dir");
        let repo = base.join("repo");
        std::fs::create_dir(&repo).expect("create repo");
        git(&repo, &["init", "-q", "-b", "main"]);
        std::fs::write(repo.join("file"), "one\n").expect("write file");
        git(&repo, &["add", "file"]);
        git(&repo, &["commit", "-qm", "initial"]);
        Self {
            _root: root,
            base,
            repo,
        }
    }

    fn ctx(&self, dir: &Path) -> Ctx {
        Ctx::new(dir.to_path_buf(), Config::default())
    }

    fn path(&self, name: &str) -> String {
        self.base.join(name).to_string_lossy().into_owned()
    }
}

#[test]
fn prune_never_bypasses_a_worktree_lock() {
    let fx = Fixture::new();
    let locked = fx.path("locked");
    git(&fx.repo, &["worktree", "add", "-qb", "locked", &locked]);
    git(
        &fx.repo,
        &[
            "worktree",
            "lock",
            "--reason",
            "Keep this checkout",
            &locked,
        ],
    );
    let ctx = fx.ctx(&fx.repo);
    for force in [false, true] {
        let mut log = Vec::new();
        assert!(!remove_prune_worktree(&ctx, &locked, force, &mut log));
        assert!(Path::new(&locked).join("file").exists());
    }
}

#[test]
fn prune_removes_dirty_worktrees_only_with_force() {
    let fx = Fixture::new();
    let dirty = fx.path("dirty");
    git(&fx.repo, &["worktree", "add", "-qb", "dirty", &dirty]);
    std::fs::write(Path::new(&dirty).join("file"), "one\nchange\n").expect("edit");
    let ctx = fx.ctx(&fx.repo);
    let mut log = Vec::new();
    assert!(!remove_prune_worktree(&ctx, &dirty, false, &mut log));
    assert!(Path::new(&dirty).join("file").exists());
    assert!(remove_prune_worktree(&ctx, &dirty, true, &mut log));
    assert!(!Path::new(&dirty).exists());
}

#[test]
fn created_branches_record_their_base_and_stay_protected() {
    let fx = Fixture::new();
    let fresh = fx.path("fresh");
    let ctx = fx.ctx(&fx.repo);
    assert!(add_worktree_branch(&ctx, "fresh", &fresh, "HEAD").is_ok());
    assert_eq!(
        git(&fx.repo, &["rev-parse", "fresh"]),
        git(&fx.repo, &["config", "branch.fresh.worktreeBase"])
    );
    git(
        &fx.repo,
        &["commit", "-q", "--allow-empty", "-m", "main moves on"],
    );
    git(
        &fx.repo,
        &["reflog", "expire", "--expire=now", "refs/heads/fresh"],
    );
    assert!(!list_prune_branches(&ctx, "HEAD").contains(&"fresh".to_string()));
    git(
        Path::new(&fresh),
        &["commit", "-q", "--allow-empty", "-m", "fresh work"],
    );
    git(&fx.repo, &["merge", "-q", "--no-edit", "fresh"]);
    assert!(list_prune_branches(&ctx, "HEAD").contains(&"fresh".to_string()));
}

#[test]
fn delete_warning_lists_commits_only_this_branch_reaches() {
    let fx = Fixture::new();
    let target = fx.path("target");
    git(&fx.repo, &["worktree", "add", "-qb", "delete-me", &target]);
    let target = PathBuf::from(target);
    git(
        &target,
        &["commit", "-q", "--allow-empty", "-m", "unique work at risk"],
    );
    let ctx = fx.ctx(&target);
    assert_eq!(default_base_ref(&ctx), "HEAD");
    let unique = || branch_unique_commits(&ctx, "delete-me").unwrap_or_else(|_| panic!("git log"));
    assert_eq!(unique(), git(&target, &["log", "-1", "--oneline"]));
    git(&target, &["branch", "saved-copy"]);
    assert_eq!(unique(), "");
    git(&target, &["branch", "-D", "saved-copy"]);
    git(
        &target,
        &["update-ref", "refs/remotes/origin/saved-copy", "HEAD"],
    );
    assert_eq!(unique(), "");
}
