use crate::context::Context;
use crate::error::{Error, Result};
use crate::help;
use crate::names::Names;
use crate::pi::Mode;
use crate::process::{Captured, CommandExt};
use crate::tty;
use crate::ui::{Color, warn};

#[derive(Debug, Default, PartialEq, Eq)]
struct Args {
    base: Option<String>,
    finish: bool,
}

impl Args {
    /// None when help was requested.
    fn parse(args: &[String]) -> Result<Option<Self>> {
        let mut parsed = Self::default();
        let mut args = args.iter();
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--finish" => parsed.finish = true,
                "--base" => {
                    let base = args
                        .next()
                        .ok_or_else(|| Error::fatal("--base requires a ref"))?;
                    parsed.base = Some(base.clone());
                }
                "-h" | "--help" => return Ok(None),
                other => return Err(Error::fatal(format!("Unknown create option: {other}"))),
            }
        }
        Ok(Some(parsed))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewWorktree {
    pub names: Names,
    pub path: String,
}

pub fn run(ctx: &Context, args: &[String]) -> Result<()> {
    ctx.require_git_repo()?;
    let Some(args) = Args::parse(args)? else {
        print!("{}", help::CREATE);
        return Ok(());
    };
    if args.finish {
        return finish(ctx);
    }
    let base = args
        .base
        .filter(|base| !base.is_empty())
        .unwrap_or_else(|| ctx.default_base_ref());
    let source = ctx.repo_root();
    if has_staged_changes(ctx) {
        create_from_staged(ctx, &base, &source)
    } else {
        create_empty(ctx, &base)
    }
}

fn has_staged_changes(ctx: &Context) -> bool {
    ctx.git(["diff", "--cached", "--quiet", "--exit-code"])
        .run()
        != 0
}

fn staged_patch(ctx: &Context, extra: &[&str]) -> Result<Vec<u8>> {
    let Captured { code, stdout } = ctx
        .git(["diff", "--cached", "--binary"])
        .args(extra)
        .capture_bytes();
    if code == 0 {
        Ok(stdout)
    } else {
        Err(Error::Status(code))
    }
}

fn create_from_staged(ctx: &Context, base: &str, source: &str) -> Result<()> {
    let patch = staged_patch(ctx, &[])?;
    let cleanup_patch = staged_patch(ctx, &["-U0"])?;
    let names = ctx.generate_names(Mode::Staged)?;
    let Names { branch, window } = ctx.confirm_names(Mode::Staged, names)?;
    let target = ctx.sibling_path_for_branch(&branch);
    ctx.validate_new_branch_and_path(&branch, &target)?;

    ctx.add_worktree_branch(&branch, &target, base)?;
    ctx.save_window(&branch, &window)?;

    let state = ctx.pending_state_for(&target);
    state.create()?;
    state.write_bytes("patch", &patch)?;
    state.write_bytes("cleanup_patch", &cleanup_patch)?;
    state.write_field("source_path", source)?;
    state.write_field("target_path", &target)?;
    state.write_field("branch", &branch)?;
    state.write_field("window", &window)?;
    state.write_field("created_at", &utc_timestamp())?;

    let patch_file = state.file("patch");
    if ctx
        .git(["-C", &target, "apply"])
        .arg(&patch_file)
        .run_silently()
        == 0
    {
        println!(
            "{}",
            Color::Green.paint("Copied staged changes to new worktree as unstaged changes.")
        );
        match ctx.remove_staged_patch(source, &state.file("cleanup_patch")) {
            Ok(()) => state.remove(),
            Err(failure) => {
                warn(&failure.to_string());
                warn(
                    "Original staged changes are still present. After inspecting, run: worktree create --finish",
                );
            }
        }
    } else {
        warn("Patch did not apply cleanly in the new worktree. Trying --reject.");
        if ctx
            .git(["-C", &target, "apply", "--reject"])
            .arg(&patch_file)
            .run_silently()
            == 0
        {
            warn(
                "Patch applied partially with .rej files. Resolve in the new worktree, then run: worktree create --finish",
            );
        } else {
            warn(&format!(
                "Could not apply patch. Patch is saved at: {}",
                patch_file.display()
            ));
        }
    }

    ctx.open_path(&target, &window)
}

fn random_petname(ctx: &Context) -> String {
    ctx.command(&ctx.config.petname)
        .args(["--words", "3", "--separator", "-"])
        .stdout_text()
}

fn unique_random_worktree(ctx: &Context) -> Result<NewWorktree> {
    (0..10)
        .map(|_| {
            let name = random_petname(ctx);
            let branch = format!("worktree/{name}");
            let path = ctx.sibling_path_for_branch(&branch);
            NewWorktree {
                names: Names {
                    branch,
                    window: name,
                },
                path,
            }
        })
        .find(|candidate| {
            !ctx.branch_exists(&candidate.names.branch) && !ctx.exists(&candidate.path)
        })
        .ok_or_else(|| Error::fatal("Could not generate a unique random worktree name"))
}

fn create_empty(ctx: &Context, base: &str) -> Result<()> {
    let new = unique_random_worktree(ctx)?;
    tty::print("\nNo staged changes.\nCreate empty worktree?\n\n")?;
    tty::print(&format!(
        "{} {}\n",
        Color::Blue.paint("Branch:"),
        new.names.branch
    ))?;
    tty::print(&format!(
        "{} {}\n\n",
        Color::Blue.paint("Window:"),
        new.names.window
    ))?;
    if tty::starts_with_yes(&tty::read_line("Create? [y/N] ")?) {
        create_worktree(ctx, base, &new)
    } else {
        Err(Error::fatal("Cancelled"))
    }
}

pub fn create_worktree(ctx: &Context, base: &str, new: &NewWorktree) -> Result<()> {
    let Names { branch, window } = &new.names;
    ctx.validate_new_branch_and_path(branch, &new.path)?;
    ctx.add_worktree_branch(branch, &new.path, base)?;
    ctx.save_window(branch, window)?;
    ctx.open_path(&new.path, window)
}

fn finish(ctx: &Context) -> Result<()> {
    ctx.require_git_repo()?;
    let state = ctx
        .pending_state_for_current()
        .ok_or_else(|| Error::fatal("No pending create state for this worktree"))?;
    let source = state.field("source_path").ok_or_else(|| {
        Error::Message(format!(
            "worktree: {}/source_path: No such file or directory",
            state.dir.display()
        ))
    })?;
    let cleanup_patch = state.file("cleanup_patch");
    let patch = if cleanup_patch.is_file() {
        cleanup_patch
    } else {
        state.file("patch")
    };
    if let Err(failure) = ctx.remove_staged_patch(&source, &patch) {
        warn(&failure.to_string());
        warn(&format!(
            "Pending create state is preserved at: {}",
            state.dir.display()
        ));
        return Err(Error::Status(1));
    }
    state.remove();
    println!("{}", Color::Green.paint("Finished worktree create."));
    Ok(())
}

/// `date -u +%FT%TZ`
fn utc_timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs());
    format_utc(secs)
}

/// Howard Hinnant's `civil_from_days`.
fn format_utc(secs: u64) -> String {
    let days = i64::try_from(secs / 86_400).unwrap_or(0);
    let rem = secs % 86_400;
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

    #[test]
    fn parses_create_args() {
        let args = |list: &[&str]| {
            list.iter()
                .map(|arg| (*arg).to_string())
                .collect::<Vec<_>>()
        };
        assert_eq!(
            Args::parse(&args(&["--base", "x", "--finish"]))
                .ok()
                .flatten(),
            Some(Args {
                base: Some("x".into()),
                finish: true
            })
        );
        assert_eq!(
            Args::parse(&args(&["--help", "--bogus"])).ok().flatten(),
            None
        );
        assert!(Args::parse(&args(&["--base"])).is_err());
    }
}
