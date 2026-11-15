//! Git queries shared by the subcommands: repository paths, branches,
//! saved window names, pending create state, and worktree records.

use std::path::PathBuf;

use crate::common::{
    Ctx, GREEN, RESET, Res, basename, capture, capture_quiet, checked, chomp, die, dirname,
    read_file, read_tab_fields, run_quiet, succeeds,
};
use crate::tmux;

pub const STATE_SUBDIR: &str = "worktree/create";

pub fn require_git_repo(ctx: &Ctx) -> Res<()> {
    if succeeds(&mut ctx.git(["rev-parse", "--is-inside-work-tree"])) {
        Ok(())
    } else {
        die("Not in a git repository")
    }
}

pub fn repo_root(ctx: &Ctx) -> String {
    capture(&mut ctx.git(["rev-parse", "--show-toplevel"])).1
}

pub fn common_git_dir(ctx: &Ctx) -> String {
    capture(&mut ctx.git(["rev-parse", "--path-format=absolute", "--git-common-dir"])).1
}

pub fn current_branch(ctx: &Ctx) -> String {
    capture(&mut ctx.git(["branch", "--show-current"])).1
}

/// The main checkout: the parent of a `.git` common dir, else the repo root.
pub fn managed_repo_root(ctx: &Ctx) -> String {
    let common = common_git_dir(ctx);
    if basename(&common) == ".git" {
        dirname(&common)
    } else {
        repo_root(ctx)
    }
}

pub fn state_root(ctx: &Ctx) -> String {
    format!("{}/{STATE_SUBDIR}", common_git_dir(ctx))
}

/// `git hash-object --stdin <<<"$text"` (a here-string adds a newline).
pub fn hash_text(ctx: &Ctx, text: &str) -> String {
    let mut command = ctx.git(["hash-object", "--stdin"]);
    match crate::common::run_with_input(&mut command, format!("{text}\n").as_bytes()) {
        Ok((_, stdout, stderr)) => {
            eprint!("{}", String::from_utf8_lossy(&stderr));
            chomp(&String::from_utf8_lossy(&stdout))
        }
        Err(_) => String::new(),
    }
}

pub fn state_dir_for_target(ctx: &Ctx, target: &str) -> String {
    format!("{}/{}", state_root(ctx), hash_text(ctx, target))
}

/// Whether `state/target_path` names `target`.
pub fn state_targets(state: &str, target: &str) -> bool {
    let file = PathBuf::from(state).join("target_path");
    file.is_file() && read_file(&file).as_deref() == Some(target)
}

pub fn find_state_for_current_target(ctx: &Ctx) -> Option<String> {
    let target = repo_root(ctx);
    let state = state_dir_for_target(ctx, &target);
    if state_targets(&state, &target) {
        return Some(state);
    }
    let root = state_root(ctx);
    let mut candidates: Vec<String> = std::fs::read_dir(&root)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_dir()))
        .filter(|entry| !entry.file_name().to_string_lossy().starts_with('.'))
        // fd printed directories with a trailing slash; keep it in messages.
        .map(|entry| format!("{}/", entry.path().to_string_lossy()))
        .collect();
    candidates.sort();
    candidates
        .into_iter()
        .find(|candidate| state_targets(candidate, &target))
}

/// Remove pending create state recorded for `path`.
pub fn remove_pending_state_for_path(ctx: &Ctx, path: &str) {
    let state = state_dir_for_target(ctx, path);
    if state_targets(&state, path) {
        let _ = std::fs::remove_dir_all(&state);
    }
}

/// sed: `[/\\]+` and `[^A-Za-z0-9._-]+` become `-`, runs collapse, and edge dashes go.
pub fn sanitize_path_component(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for ch in text.chars() {
        let keep = ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-');
        let ch = if keep { ch } else { '-' };
        if ch == '-' && out.ends_with('-') {
            continue;
        }
        out.push(ch);
    }
    out.trim_matches('-').to_string()
}

pub fn short_window_from_branch(branch: &str) -> String {
    let last = branch.rsplit('/').next().unwrap_or(branch);
    let mut window = sanitize_path_component(last);
    if window.chars().count() > 24 {
        window = window.chars().take(24).collect();
        if window.ends_with('-') {
            window.pop();
        }
    }
    if window.is_empty() {
        window = "worktree".into();
    }
    window
}

fn sibling_path(ctx: &Ctx, suffix: &str) -> String {
    let root = managed_repo_root(ctx);
    format!("{}/{}.{suffix}", dirname(&root), basename(&root))
}

pub fn repo_sibling_path_for_branch(ctx: &Ctx, branch: &str) -> String {
    sibling_path(ctx, &sanitize_path_component(branch))
}

pub fn repo_sibling_path_for_pr(ctx: &Ctx, number: &str) -> String {
    sibling_path(ctx, &format!("pr-{number}"))
}

fn branch_window_config_key(branch: &str) -> String {
    format!("branch.{branch}.worktree-window")
}

fn legacy_branch_window_config_key(branch: &str) -> String {
    format!("branch.\"{branch}\".worktree-window")
}

fn config_get(ctx: &Ctx, key: &str) -> String {
    capture_quiet(&mut ctx.git(["config", "--get", key])).1
}

pub fn saved_window_for_branch(ctx: &Ctx, branch: &str) -> Option<String> {
    if branch.is_empty() || branch == "detached" {
        return None;
    }
    let mut window = config_get(ctx, &branch_window_config_key(branch));
    if window.is_empty() {
        window = config_get(ctx, &legacy_branch_window_config_key(branch));
    }
    (!window.is_empty()).then_some(window)
}

pub fn set_saved_window_for_branch(ctx: &Ctx, branch: &str, window: &str) -> Res<()> {
    if branch.is_empty() || window.is_empty() {
        return Ok(());
    }
    checked(&mut ctx.git(["config", &branch_window_config_key(branch), window]))?;
    run_quiet(&mut ctx.git([
        "config",
        "--unset-all",
        &legacy_branch_window_config_key(branch),
    ]));
    Ok(())
}

pub fn unset_saved_window_for_branch(ctx: &Ctx, branch: &str) {
    if branch.is_empty() {
        return;
    }
    for key in [
        branch_window_config_key(branch),
        legacy_branch_window_config_key(branch),
    ] {
        run_quiet(&mut ctx.git(["config", "--unset-all", &key]));
    }
}

fn branch_from_window_config_key(key: &str) -> String {
    let branch = key.strip_prefix("branch.").unwrap_or(key);
    let branch = branch.strip_suffix(".worktree-window").unwrap_or(branch);
    let branch = branch.strip_prefix('"').unwrap_or(branch);
    branch.strip_suffix('"').unwrap_or(branch).to_string()
}

pub fn cleanup_stale_saved_windows(ctx: &Ctx) {
    let listing = capture_quiet(&mut ctx.git(["config", "--get-regexp", "worktree-window$"])).1;
    let keys: Vec<String> = listing
        .lines()
        .filter_map(|line| line.split_whitespace().next())
        // awk: $1 ~ /^branch\..*\.worktree-window$/
        .filter(|key| {
            key.len() >= "branch.".len() + ".worktree-window".len()
                && key.starts_with("branch.")
                && key.ends_with(".worktree-window")
        })
        .map(str::to_string)
        .collect();
    for key in keys {
        let branch = branch_from_window_config_key(&key);
        if branch_exists(ctx, &branch) {
            continue;
        }
        run_quiet(&mut ctx.git(["config", "--remove-section", &format!("branch.{branch}")]));
        run_quiet(&mut ctx.git([
            "config",
            "--remove-section",
            &format!("branch.\"{branch}\""),
        ]));
        run_quiet(&mut ctx.git(["config", "--unset-all", &key]));
        println!("{GREEN}Cleaned:{RESET} stale window config: {key}");
    }
}

/// The digits of a `.pr-<number>` suffix.
pub fn pr_number_suffix(name: &str) -> Option<&str> {
    let index = name.rfind(".pr-")?;
    let digits = &name[index + 4..];
    (!digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit())).then_some(digits)
}

pub fn desired_window_for_worktree(ctx: &Ctx, path: &str, branch: &str) -> String {
    if let Some(window) = saved_window_for_branch(ctx, branch) {
        return window;
    }
    let base = basename(path);
    if let Some(number) = pr_number_suffix(&base) {
        return format!("pr-{number}");
    }
    if !branch.is_empty() && branch != "detached" {
        short_window_from_branch(branch)
    } else {
        short_window_from_branch(&base)
    }
}

pub fn branch_exists(ctx: &Ctx, branch: &str) -> bool {
    succeeds(&mut ctx.git([
        "show-ref",
        "--verify",
        "--quiet",
        &format!("refs/heads/{branch}"),
    ]))
}

fn worktree_porcelain(ctx: &Ctx) -> String {
    capture(&mut ctx.git(["worktree", "list", "--porcelain"])).1
}

pub fn branch_checked_out_path(ctx: &Ctx, branch: &str) -> String {
    let wanted = format!("refs/heads/{branch}");
    let mut path = String::new();
    for line in worktree_porcelain(ctx).lines() {
        if let Some(rest) = line.strip_prefix("worktree ") {
            path = rest.to_string();
        } else if line.strip_prefix("branch ") == Some(wanted.as_str()) {
            return path;
        }
    }
    String::new()
}

/// Whether the porcelain listing marks the worktree at `target` as locked.
pub fn worktree_locked(ctx: &Ctx, target: &str) -> bool {
    let mut path = "";
    let listing = worktree_porcelain(ctx);
    for line in listing.lines() {
        if let Some(rest) = line.strip_prefix("worktree ") {
            path = rest;
        } else if (line == "locked" || line.starts_with("locked ")) && path == target {
            return true;
        }
    }
    false
}

pub fn validate_new_branch_and_path(ctx: &Ctx, branch: &str, path: &str) -> Res<()> {
    if crate::common::run_no_stdout(&mut ctx.git(["check-ref-format", "--branch", branch])) != 0 {
        return die(format!("Invalid branch name: {branch}"));
    }
    if branch_exists(ctx, branch) {
        return die(format!("Branch already exists: {branch}"));
    }
    if ctx.exists(path) {
        return die(format!("Path already exists: {path}"));
    }
    Ok(())
}

fn origin_head(ctx: &Ctx) -> String {
    capture_quiet(&mut ctx.git([
        "symbolic-ref",
        "--quiet",
        "--short",
        "refs/remotes/origin/HEAD",
    ]))
    .1
}

/// origin/HEAD, then the current branch's upstream, then HEAD.
pub fn default_base_ref(ctx: &Ctx) -> String {
    let origin = origin_head(ctx);
    if !origin.is_empty() {
        return origin;
    }
    if !current_branch(ctx).is_empty() {
        let upstream = capture_quiet(&mut ctx.git([
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ]))
        .1;
        if !upstream.is_empty() {
            return upstream;
        }
    }
    "HEAD".into()
}

pub fn default_branch_name(ctx: &Ctx) -> String {
    let origin = origin_head(ctx);
    if !origin.is_empty() {
        return origin
            .strip_prefix("origin/")
            .unwrap_or(&origin)
            .to_string();
    }
    for name in ["main", "master"] {
        if branch_exists(ctx, name) {
            return name.into();
        }
    }
    let root = managed_repo_root(ctx);
    let root_branch = capture_quiet(&mut ctx.git(["-C", &root, "branch", "--show-current"])).1;
    if !root_branch.is_empty() {
        return root_branch;
    }
    current_branch(ctx)
}

/// Whether `git -C path status --porcelain` reports anything.
pub fn has_local_changes(ctx: &Ctx, path: &str) -> bool {
    !capture(&mut ctx.git(["-C", path, "status", "--porcelain"]))
        .1
        .is_empty()
}

/// `git worktree add -b`, then record the creation commit so prune can tell
/// a never-committed branch from a merged one.
pub fn add_worktree_branch(ctx: &Ctx, branch: &str, target: &str, base: &str) -> Res<()> {
    checked(&mut ctx.git(["worktree", "add", "-b", branch, target, base]))?;
    let tip = capture(&mut ctx.git([
        "rev-parse",
        "--verify",
        &format!("refs/heads/{branch}^{{commit}}"),
    ]))
    .1;
    checked(&mut ctx.git(["config", &format!("branch.{branch}.worktreeBase"), &tip]))
}

/// A `git worktree list` entry: branch (or `detached`) and path.
pub fn list_worktrees(ctx: &Ctx) -> Vec<(String, String)> {
    let mut rows = Vec::new();
    let mut current: Option<(String, String)> = None;
    for line in worktree_porcelain(ctx).lines() {
        if let Some(path) = line.strip_prefix("worktree ") {
            if let Some((branch, path)) = current.take() {
                rows.push((branch, path));
            }
            current = Some((String::new(), path.to_string()));
        } else if let Some(branch) = line.strip_prefix("branch refs/heads/")
            && let Some(entry) = current.as_mut()
        {
            entry.0 = branch.to_string();
        }
    }
    rows.extend(current);
    rows.into_iter()
        .map(|(branch, path)| {
            let branch = if branch.is_empty() {
                "detached".into()
            } else {
                branch
            };
            (branch, path)
        })
        .collect()
}

pub fn worktree_tsv(rows: &[(String, String)]) -> Vec<String> {
    rows.iter()
        .map(|(branch, path)| format!("{branch}\t{path}"))
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Record {
    pub branch: String,
    pub window: String,
    pub managed: String,
    pub path: String,
}

impl Record {
    pub fn parse(line: &str) -> Self {
        let mut fields = read_tab_fields(line, 4).into_iter();
        let mut next = || fields.next().unwrap_or_default();
        Self {
            branch: next(),
            window: next(),
            managed: next(),
            path: next(),
        }
    }

    pub fn line(&self) -> String {
        format!(
            "{}\t{}\t{}\t{}",
            self.branch, self.window, self.managed, self.path
        )
    }
}

pub fn list_worktree_records(ctx: &Ctx) -> Vec<Record> {
    let main_root = ctx.canonical(&managed_repo_root(ctx));
    list_worktrees(ctx)
        .into_iter()
        .map(|line| {
            // Each row passes through `IFS=$'\t' read -r branch path`.
            let fields = read_tab_fields(&format!("{}\t{}", line.0, line.1), 2);
            let (branch, path) = (fields[0].clone(), fields[1].clone());
            let managed = if branch == "detached" || ctx.canonical(&path) == main_root {
                "no"
            } else {
                "yes"
            };
            let window = tmux::window_name_for_path(ctx, &path)
                .filter(|name| !name.is_empty())
                .unwrap_or_else(|| "-".into());
            Record {
                branch,
                window,
                managed: managed.into(),
                path,
            }
        })
        .collect()
}

pub fn managed_worktree_records(ctx: &Ctx) -> Vec<Record> {
    list_worktree_records(ctx)
        .into_iter()
        .filter(|record| record.managed == "yes")
        .collect()
}

/// Print an aligned table: every column but the last is padded.
pub fn format_table(header: &[&str], rows: &[Vec<String>]) -> String {
    let columns = header.len();
    let mut widths: Vec<usize> = header.iter().map(|h| h.chars().count()).collect();
    for row in rows {
        for (index, width) in widths.iter_mut().enumerate() {
            let len = row.get(index).map_or(0, |cell| cell.chars().count());
            *width = (*width).max(len);
        }
    }
    let mut out = String::new();
    let header_row: Vec<String> = header.iter().map(|h| (*h).to_string()).collect();
    for row in std::iter::once(&header_row).chain(rows) {
        for (index, width) in widths.iter().enumerate() {
            let cell = row.get(index).map_or("", String::as_str);
            if index + 1 == columns {
                out.push_str(cell);
            } else {
                out.push_str(&format!("{cell:<width$}  "));
            }
        }
        out.push('\n');
    }
    out
}

/// Split a tab-separated row the way awk -F '\t' does.
pub fn awk_fields(line: &str) -> Vec<String> {
    line.split('\t').map(str::to_string).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_like_sed() {
        assert_eq!(sanitize_path_component("feat/a b\\c"), "feat-a-b-c");
        assert_eq!(sanitize_path_component("--x--y--"), "x-y");
        assert_eq!(sanitize_path_component("ünï"), "n");
    }

    #[test]
    fn short_windows() {
        assert_eq!(short_window_from_branch("feature/add-thing"), "add-thing");
        assert_eq!(short_window_from_branch("x/"), "worktree");
        assert_eq!(
            short_window_from_branch("abcdefghijklmnopqrstuvw-xyz"),
            "abcdefghijklmnopqrstuvw"
        );
    }

    #[test]
    fn pr_suffix() {
        assert_eq!(pr_number_suffix("repo.pr-12"), Some("12"));
        assert_eq!(pr_number_suffix("repo.pr-1x"), None);
        assert_eq!(pr_number_suffix("repo.pr-"), None);
    }

    #[test]
    fn window_keys_round_trip() {
        assert_eq!(
            branch_from_window_config_key("branch.a/b.worktree-window"),
            "a/b"
        );
        assert_eq!(
            branch_from_window_config_key("branch.\"x\".worktree-window"),
            "x"
        );
    }

    #[test]
    fn table_pads_all_but_last_column() {
        let rows = vec![vec!["main".into(), "-".into(), "no".into(), "/r".into()]];
        assert_eq!(
            format_table(&["Branch", "Window", "Managed", "Path"], &rows),
            "Branch  Window  Managed  Path\nmain    -       no       /r\n"
        );
    }
}
