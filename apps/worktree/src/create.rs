//! `worktree create`: new sibling worktrees, moving staged changes when present.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use crate::common::{
    BLUE, Ctx, Fail, GREEN, RESET, Res, TempDir, capture, capture_bytes, die, read_file, run,
    run_quiet, split_first_tab, starts_with_yes, tty_print, tty_read_checked, warn, write_line,
};
use crate::help;
use crate::naming::{Mode, confirm_names, generate_names};
use crate::repo::{
    add_worktree_branch, branch_exists, default_base_ref, find_state_for_current_target, repo_root,
    repo_sibling_path_for_branch, require_git_repo, set_saved_window_for_branch,
    state_dir_for_target, validate_new_branch_and_path,
};
use crate::tmux::open_path;

pub fn run_command(ctx: &Ctx, args: &[String]) -> Res<()> {
    require_git_repo(ctx)?;
    let mut base = String::new();
    let mut finish = false;
    let mut rest = args.iter();
    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "--finish" => finish = true,
            "--base" => match rest.next() {
                Some(value) => base.clone_from(value),
                None => return die("--base requires a ref"),
            },
            "-h" | "--help" => {
                print!("{}", help::CREATE);
                return Err(Fail::Exit(0));
            }
            other => return die(format!("Unknown create option: {other}")),
        }
    }

    if finish {
        return finish_create(ctx);
    }
    if base.is_empty() {
        base = default_base_ref(ctx);
    }
    let source = repo_root(ctx);
    if has_staged_changes(ctx) {
        create_from_staged(ctx, &base, &source)
    } else {
        create_empty(ctx, &base)
    }
}

fn has_staged_changes(ctx: &Ctx) -> bool {
    run(&mut ctx.git(["diff", "--cached", "--quiet", "--exit-code"])) != 0
}

fn staged_patch(ctx: &Ctx, extra: &[&str]) -> Res<Vec<u8>> {
    let mut command = ctx.git(["diff", "--cached", "--binary"]);
    command.args(extra);
    match capture_bytes(&mut command) {
        (0, bytes) => Ok(bytes),
        (code, _) => Err(Fail::Exit(code)),
    }
}

fn write_state_file(path: &Path, bytes: &[u8]) -> Res<()> {
    std::fs::write(path, bytes).map_err(|err| {
        eprintln!(
            "worktree: {}: {}",
            path.display(),
            crate::common::io_message(&err)
        );
        Fail::Exit(1)
    })
}

fn create_from_staged(ctx: &Ctx, base: &str, source: &str) -> Res<()> {
    let patch = staged_patch(ctx, &[])?;
    let cleanup_patch = staged_patch(ctx, &["-U0"])?;
    let (branch, window) = split_first_tab(&generate_names(ctx, Mode::Staged)?);
    let (branch, window) = confirm_names(ctx, Mode::Staged, "Create", branch, window)?;
    let target = repo_sibling_path_for_branch(ctx, &branch);
    validate_new_branch_and_path(ctx, &branch, &target)?;

    add_worktree_branch(ctx, &branch, &target, base)?;
    set_saved_window_for_branch(ctx, &branch, &window)?;

    let state = state_dir_for_target(ctx, &target);
    let state_path = PathBuf::from(&state);
    std::fs::create_dir_all(&state_path).map_err(|err| {
        eprintln!("mkdir: {state}: {}", crate::common::io_message(&err));
        Fail::Exit(1)
    })?;
    write_state_file(&state_path.join("patch"), &patch)?;
    write_state_file(&state_path.join("cleanup_patch"), &cleanup_patch)?;
    write_line(&state_path.join("source_path"), source)?;
    write_line(&state_path.join("target_path"), &target)?;
    write_line(&state_path.join("branch"), &branch)?;
    write_line(&state_path.join("window"), &window)?;
    write_line(&state_path.join("created_at"), &utc_timestamp())?;

    let patch_file = format!("{state}/patch");
    if run_quiet(&mut ctx.git(["-C", &target, "apply", &patch_file])) == 0 {
        println!("{GREEN}Copied staged changes to new worktree as unstaged changes.{RESET}");
        if remove_original_patch_from_source(ctx, source, &format!("{state}/cleanup_patch")) {
            let _ = std::fs::remove_dir_all(&state_path);
        } else {
            warn(
                "Original staged changes are still present. After inspecting, run: worktree create --finish",
            );
        }
    } else {
        warn("Patch did not apply cleanly in the new worktree. Trying --reject.");
        if run_quiet(&mut ctx.git(["-C", &target, "apply", "--reject", &patch_file])) == 0 {
            warn(
                "Patch applied partially with .rej files. Resolve in the new worktree, then run: worktree create --finish",
            );
        } else {
            warn(&format!(
                "Could not apply patch. Patch is saved at: {patch_file}"
            ));
        }
    }

    open_path(ctx, &target, &window)
}

fn generate_random_petname(ctx: &Ctx) -> String {
    capture(
        ctx.command(&ctx.cfg.petname)
            .args(["--words", "3", "--separator", "-"]),
    )
    .1
}

fn make_unique_random_names(ctx: &Ctx) -> Res<(String, String, String)> {
    for _ in 0..10 {
        let name = generate_random_petname(ctx);
        let branch = format!("worktree/{name}");
        let path = repo_sibling_path_for_branch(ctx, &branch);
        if !branch_exists(ctx, &branch) && !ctx.exists(&path) {
            return Ok((branch, name, path));
        }
    }
    die("Could not generate a unique random worktree name")
}

fn create_empty(ctx: &Ctx, base: &str) -> Res<()> {
    let (branch, window, target) = make_unique_random_names(ctx)?;
    tty_print("\nNo staged changes.\nCreate empty worktree?\n\n")?;
    tty_print(&format!("{BLUE}Branch:{RESET} {branch}\n"))?;
    tty_print(&format!("{BLUE}Window:{RESET} {window}\n\n"))?;
    let response = tty_read_checked("Create? [y/N] ")?;
    if starts_with_yes(&response) {
        create_worktree(ctx, base, &branch, &window, &target)
    } else {
        die("Cancelled")
    }
}

/// Create a branch worktree from `base`, remember its window, and open it.
pub fn create_worktree(ctx: &Ctx, base: &str, branch: &str, window: &str, target: &str) -> Res<()> {
    validate_new_branch_and_path(ctx, branch, target)?;
    add_worktree_branch(ctx, branch, target, base)?;
    set_saved_window_for_branch(ctx, branch, window)?;
    open_path(ctx, target, window)
}

fn finish_create(ctx: &Ctx) -> Res<()> {
    require_git_repo(ctx)?;
    let Some(state) = find_state_for_current_target(ctx) else {
        return die("No pending create state for this worktree");
    };
    let state_path = PathBuf::from(&state);
    let Some(source) = read_file(&state_path.join("source_path")) else {
        eprintln!("worktree: {state}/source_path: No such file or directory");
        return Err(Fail::Exit(1));
    };
    let patch = if state_path.join("cleanup_patch").is_file() {
        format!("{state}/cleanup_patch")
    } else {
        format!("{state}/patch")
    };
    if !remove_original_patch_from_source(ctx, &source, &patch) {
        warn(&format!("Pending create state is preserved at: {state}"));
        return Err(Fail::Exit(1));
    }
    let _ = std::fs::remove_dir_all(&state_path);
    println!("{GREEN}Finished worktree create.{RESET}");
    Ok(())
}

/// Reverse the staged patch in the source worktree: working tree first, then
/// the index. Leaves everything untouched when that cannot be done safely.
pub fn remove_original_patch_from_source(ctx: &Ctx, source: &str, patch: &str) -> bool {
    if !ctx.is_dir(source) {
        warn(&format!("Source worktree no longer exists: {source}"));
        return false;
    }
    let apply = |extra: &[&str]| {
        let mut command = ctx.git(["-C", source, "apply", "-R"]);
        command.args(extra).arg(patch);
        command
    };

    if run_quiet(&mut apply(&["--cached", "--unidiff-zero", "--check"])) != 0 {
        warn(&format!(
            "Could not remove original staged changes from index safely. They remain staged in: {source}"
        ));
        return false;
    }

    let working_tree_ok = if run_quiet(&mut apply(&["--unidiff-zero", "--check"])) == 0 {
        run(&mut apply(&["--unidiff-zero"])) == 0
    } else {
        reverse_patch_with_gnu_patch(ctx, source, patch)
    };
    if !working_tree_ok {
        warn(&format!(
            "Could not remove original staged changes from working tree safely. They remain staged in: {source}"
        ));
        return false;
    }

    if run(&mut apply(&["--cached", "--unidiff-zero"])) != 0 {
        warn(&format!(
            "Could not remove original staged changes from index safely. Pending state remains for recovery: {source}"
        ));
        return false;
    }
    println!("{GREEN}Removed original staged changes from index.{RESET}");
    true
}

/// Saved copies of the staged paths so a failed `patch -R` can be undone.
struct Backup {
    dir: TempDir,
    /// (present, path) for every staged path.
    entries: Vec<(bool, String)>,
}

fn copy_all(from: &Path, to: &Path) -> std::io::Result<()> {
    let meta = from.symlink_metadata()?;
    if meta.file_type().is_symlink() {
        std::os::unix::fs::symlink(std::fs::read_link(from)?, to)
    } else if meta.is_dir() {
        std::fs::create_dir_all(to)?;
        std::fs::set_permissions(to, meta.permissions())?;
        for entry in std::fs::read_dir(from)? {
            let entry = entry?;
            copy_all(&entry.path(), &to.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        std::fs::copy(from, to).map(|_| ())
    }
}

fn parent_dir(base: &Path, path: &str) -> PathBuf {
    match path.rfind('/') {
        Some(index) => base.join(&path[..index]),
        None => base.to_path_buf(),
    }
}

fn backup_patch_paths(ctx: &Ctx, source: &str) -> Res<Backup> {
    let dir = TempDir::new()?;
    let files = dir.path().join("files");
    let names = capture_bytes(
        ctx.git(["-C", source, "diff", "--cached", "--name-only", "-z"])
            .stderr(Stdio::inherit()),
    )
    .1;
    let mut entries = Vec::new();
    for raw in names.split(|b| *b == 0).filter(|raw| !raw.is_empty()) {
        let path = String::from_utf8_lossy(raw).into_owned();
        let original = Path::new(source).join(&path);
        let present = original.symlink_metadata().is_ok();
        if present {
            let _ = std::fs::create_dir_all(parent_dir(&files, &path));
            let _ = copy_all(&original, &files.join(&path));
        }
        entries.push((present, path));
    }
    Ok(Backup { dir, entries })
}

fn restore_patch_paths(source: &str, backup: &Backup) {
    let files = backup.dir.path().join("files");
    for (present, path) in &backup.entries {
        let target = Path::new(source).join(path);
        if let Ok(meta) = target.symlink_metadata() {
            let _ = if meta.is_dir() {
                std::fs::remove_dir_all(&target)
            } else {
                std::fs::remove_file(&target)
            };
        }
        if *present {
            let _ = std::fs::create_dir_all(parent_dir(Path::new(source), path));
            let _ = copy_all(&files.join(path), &target);
        }
    }
}

fn reverse_patch_with_gnu_patch(ctx: &Ctx, source: &str, patch: &str) -> bool {
    let Ok(backup) = backup_patch_paths(ctx, source) else {
        return false;
    };
    let reject = backup.dir.path().join("reject");
    let input = std::fs::File::open(ctx.resolve(patch));
    let status = match input {
        Ok(input) => {
            let mut command = std::process::Command::new(&ctx.cfg.patch);
            command
                .current_dir(ctx.resolve(source))
                .args(["--batch", "--forward", "--fuzz=0", "-p1", "-R"])
                .arg(format!("--reject-file={}", reject.display()))
                .stdin(input);
            run_quiet(&mut command)
        }
        Err(_) => 1,
    };
    let rejected = std::fs::metadata(&reject).is_ok_and(|meta| meta.len() > 0);
    if status == 0 && !rejected {
        return true;
    }
    restore_patch_paths(source, &backup);
    false
}

/// `date -u +%FT%TZ`
fn utc_timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    format_utc(secs)
}

fn format_utc(secs: u64) -> String {
    let days = i64::try_from(secs / 86_400).unwrap_or(0);
    let rem = secs % 86_400;
    // Howard Hinnant's civil_from_days.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        rem % 3600 / 60,
        rem % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_utc_like_date() {
        assert_eq!(format_utc(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_utc(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(format_utc(1_794_830_400), "2026-11-16T12:00:00Z");
    }
}
