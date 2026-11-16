use dot::json::{self, json};
use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicUsize, Ordering};

struct Fixture {
    root: PathBuf,
    shell: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        static COUNTER: AtomicUsize = AtomicUsize::new(0);
        let root = std::env::temp_dir().join(format!(
            "tm-switcher-{}-{} space's",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        let shell = std::env::split_paths(&std::env::var_os("PATH").unwrap())
            .map(|directory| directory.join("bash"))
            .find(|path| path.is_file())
            .expect("bash is required for test fixtures");
        let fixture = Self { root, shell };
        fixture.script(
            "tmux",
            r#"
entry=
for arg in "$@"; do entry="$entry<$arg>"; done
printf '%s\n' "$entry" >> "$CASE_DIR/tmux.log"
case "$1" in
  has-session)
    if [ "$#" = 1 ]; then exit "${HAS_SESSION_CODE-0}"; fi
    case "|${COLLISIONS-}|" in
      *"|$3|"*) exit 0 ;;
      *) exit 1 ;;
    esac ;;
  list-sessions)
    if [ "${LIST_FAIL-0}" = 1 ]; then exit 1; fi
    if [ "$3" = $'#{session_id}\t#{session_name}' ]; then
      printf '%s' "${SESSION_ROWS-}"
    else
      printf '%s' "${PATH_ROWS-}"
    fi ;;
  new-session)
    if [ "${NEW_FAIL-0}" = 1 ]; then exit 7; fi
    printf '%s\n' "$NEW_ID" ;;
  set-option)
    exit "${SET_FAIL-0}" ;;
  kill-session)
    exit "${KILL_FAIL-0}" ;;
  attach-session|switch-client)
    printf '%s\n' "$1"
    exit "${CONNECT_FAIL-0}" ;;
  *) exit 2 ;;
esac
"#,
        );
        fixture.script(
            "ghq",
            r#"
printf '%s\n' called >> "$CASE_DIR/ghq.log"
printf '%s' "${REPOS-}"
exit "${GHQ_CODE-0}"
"#,
        );
        fixture.script(
            "fzf",
            r#"
printf '%s\n' "$@" > "$CASE_DIR/fzf.args"
while IFS= read -r line; do
  printf '%s\n' "$line" >> "$CASE_DIR/fzf.input"
done
if [ "${RUN_RELOAD-0}" = 1 ]; then
  prefix='--bind=ctrl-r:reload('
  suffix=')+change-header(Repos/orgs)'
  for arg in "$@"; do
    case "$arg" in
      --bind=ctrl-r:reload*)
        callback="${arg#"$prefix"}"
        callback="${callback%"$suffix"}"
        "$TEST_SHELL" -c "$callback" > "$CASE_DIR/reload.output" || exit 99 ;;
    esac
  done
fi
printf '%s' "${SELECTION-}"
exit "${FZF_CODE-0}"
"#,
        );
        fixture
    }

    fn script(&self, name: &str, body: &str) {
        let path = self.root.join(name);
        fs::write(
            &path,
            format!("#!{}\nset -eu\n{body}", self.shell.display()),
        )
        .unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o700)).unwrap();
    }

    fn command(&self) -> Command {
        let config = json!({
            "tmux":self.root.join("tmux").to_str().unwrap(),
            "ghq":self.root.join("ghq").to_str().unwrap(),
            "fuzzyFinder":self.root.join("fzf").to_str().unwrap(),
            "includeParentDirectories":true
        });
        let config_path = self.root.join("config space's.json");
        fs::write(&config_path, json::to_string(&config).unwrap()).unwrap();
        let mut command = Command::new(env!("CARGO_BIN_EXE_tm-switcher"));
        command
            .args(["--config", config_path.to_str().unwrap()])
            .env_remove("TMUX")
            // No jq, coreutils, sha256sum, or unconfigured tmux/ghq/fzf is available.
            .env("PATH", "")
            .env("CASE_DIR", &self.root)
            .env("TEST_SHELL", &self.shell)
            .env("NEW_ID", "$new");
        command
    }

    fn repo(&self) -> PathBuf {
        let path = self.root.join("repo.name:part");
        fs::create_dir(&path).unwrap();
        path.canonicalize().unwrap()
    }

    fn select_repo(command: &mut Command, path: &Path) {
        command.env(
            "SELECTION",
            format!("repo\t{}\t{}\n", path.display(), path.display()),
        );
    }

    fn log(&self) -> String {
        fs::read_to_string(self.root.join("tmux.log")).unwrap_or_default()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.root).unwrap();
    }
}

fn success(output: &Output) {
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn repo_candidates_deduplicate_include_parents_and_query_ghq_once() {
    let fixture = Fixture::new();
    let output = fixture
        .command()
        .arg("repo-targets")
        .env("REPOS", "/code/org/z\n/code/org/a\n/code/org/z\n")
        .output()
        .unwrap();
    success(&output);
    assert_eq!(output.stdout, b"repo\t/code/org\t/code/org\nrepo\t/code/org/a\t/code/org/a\nrepo\t/code/org/z\t/code/org/z\n");
    assert_eq!(
        fs::read_to_string(fixture.root.join("ghq.log")).unwrap(),
        "called\n"
    );
    assert!(fixture.log().is_empty());
}

#[test]
fn session_candidates_preserve_names_and_provider_failures_are_empty() {
    let fixture = Fixture::new();
    let output = fixture
        .command()
        .arg("session-targets")
        .env("SESSION_ROWS", "$1\tname with spaces\n$2\tother\n")
        .output()
        .unwrap();
    success(&output);
    assert_eq!(
        output.stdout,
        b"session\t$1\tname with spaces\nsession\t$2\tother\n"
    );
    let output = fixture
        .command()
        .arg("session-targets")
        .env("LIST_FAIL", "1")
        .output()
        .unwrap();
    success(&output);
    assert!(output.stdout.is_empty());
    let output = fixture
        .command()
        .arg("repo-targets")
        .env("GHQ_CODE", "1")
        .output()
        .unwrap();
    success(&output);
    assert!(output.stdout.is_empty());
}

#[test]
fn attaches_outside_tmux_and_switches_inside() {
    for inside in [false, true] {
        let fixture = Fixture::new();
        let mut command = fixture.command();
        command
            .env("SELECTION", "session\t$1\tname\n")
            .env("SESSION_ROWS", "$1\tname\n");
        if inside {
            command.env("TMUX", "/tmp/socket,123,0");
        }
        let output = command.output().unwrap();
        success(&output);
        let action = if inside {
            "switch-client"
        } else {
            "attach-session"
        };
        assert_eq!(output.stdout, format!("{action}\n").as_bytes());
        assert!(fixture.log().ends_with(&format!("<{action}><-t><$1>\n")));
        assert_eq!(
            fs::read_to_string(fixture.root.join("fzf.input")).unwrap(),
            "session\t$1\tname\n"
        );
        let args = fs::read_to_string(fixture.root.join("fzf.args")).unwrap();
        assert!(args.contains("ctrl-r:reload(") && args.contains("ctrl-d:execute("));
    }
}

#[test]
fn empty_tmux_environment_still_attaches() {
    let fixture = Fixture::new();
    let output = fixture
        .command()
        .env("TMUX", "")
        .env("SELECTION", "session\t$1\tname\n")
        .output()
        .unwrap();
    success(&output);
    assert_eq!(output.stdout, b"attach-session\n");
}

#[test]
fn without_sessions_selector_starts_with_repositories() {
    let fixture = Fixture::new();
    let output = fixture
        .command()
        .env("HAS_SESSION_CODE", "1")
        .env("REPOS", "/code/org/repo\n")
        .output()
        .unwrap();
    success(&output);
    let args = fs::read_to_string(fixture.root.join("fzf.args")).unwrap();
    assert!(args.contains("--header=Repos/orgs") && !args.contains("--bind="));
    assert!(
        fs::read_to_string(fixture.root.join("fzf.input"))
            .unwrap()
            .contains("repo\t/code/org/repo")
    );
}

#[test]
fn cancellation_empty_and_invalid_selections_do_not_mutate_sessions() {
    for (code, selection) in [
        ("130", "session\t$1\tname"),
        ("0", ""),
        ("0", "unknown\t$1"),
    ] {
        let fixture = Fixture::new();
        let output = fixture
            .command()
            .env("FZF_CODE", code)
            .env("SELECTION", selection)
            .output()
            .unwrap();
        success(&output);
        let log = fixture.log();
        assert!(
            !log.contains("<new-session>")
                && !log.contains("<set-option>")
                && !log.contains("<attach-session>")
                && !log.contains("<switch-client>")
        );
    }
}

#[test]
fn creates_session_in_canonical_repo_and_sets_metadata() {
    let fixture = Fixture::new();
    let repo = fixture.repo();
    let link = fixture.root.join("repo link's");
    symlink(&repo, &link).unwrap();
    let mut command = fixture.command();
    Fixture::select_repo(&mut command, &link);
    success(&command.output().unwrap());
    let log = fixture.log();
    assert!(log.contains(&format!(
        "<new-session><-P><-F><#{{session_id}}><-s><repo_name_part><-c><{}><-d>",
        repo.display()
    )));
    assert!(log.contains(&format!(
        "<set-option><-t><$new><@repo_path><{}>",
        repo.display()
    )));
    assert!(log.ends_with("<attach-session><-t><$new>\n"));
}

#[test]
fn reuses_sessions_by_saved_path_or_fallback_session_path_including_symlinks() {
    for saved in [false, true] {
        let fixture = Fixture::new();
        let repo = fixture.repo();
        let link = fixture.root.join("repo link");
        symlink(&repo, &link).unwrap();
        let rows = if saved {
            format!("$existing\u{1f}{}\u{1f}/different\n", link.display())
        } else {
            format!("$existing\u{1f}\u{1f}{}\n", link.display())
        };
        let mut command = fixture.command();
        command.env("PATH_ROWS", rows);
        Fixture::select_repo(&mut command, &repo);
        success(&command.output().unwrap());
        let log = fixture.log();
        assert!(!log.contains("<new-session>"));
        assert!(log.contains("<set-option><-t><$existing>"));
        assert!(log.ends_with("<attach-session><-t><$existing>\n"));
    }
}

#[test]
fn nonempty_saved_path_takes_precedence_over_session_path() {
    let fixture = Fixture::new();
    let repo = fixture.repo();
    let mut command = fixture.command();
    command.env(
        "PATH_ROWS",
        format!("$existing\u{1f}/missing\u{1f}{}\n", repo.display()),
    );
    Fixture::select_repo(&mut command, &repo);
    success(&command.output().unwrap());
    assert!(fixture.log().contains("<new-session>"));
}

#[test]
fn colliding_names_use_sha256_then_numeric_suffixes() {
    let fixture = Fixture::new();
    let repo = fixture.repo();
    let suffix = dot::hash::sha256_hex(repo.to_str().unwrap().as_bytes());
    let hashed = format!("repo_name_part-{}", &suffix[..10]);
    let mut command = fixture.command();
    command.env(
        "COLLISIONS",
        format!("=repo_name_part|={hashed}|={hashed}-1"),
    );
    Fixture::select_repo(&mut command, &repo);
    success(&command.output().unwrap());
    let log = fixture.log();
    assert!(log.contains(&format!("<has-session><-t><={hashed}-1>")));
    assert!(log.contains(&format!("<-s><{hashed}-2>")));
}

#[test]
fn failures_during_creation_or_metadata_do_not_attach() {
    for failure in ["creation", "missing_id", "metadata", "missing_repo"] {
        let fixture = Fixture::new();
        let repo = fixture.repo();
        let mut command = fixture.command();
        Fixture::select_repo(&mut command, &repo);
        match failure {
            "creation" => {
                command.env("NEW_FAIL", "1");
            }
            "missing_id" => {
                command.env("NEW_ID", "");
            }
            "metadata" => {
                command.env("SET_FAIL", "7");
            }
            "missing_repo" => {
                Fixture::select_repo(&mut command, &fixture.root.join("missing"));
            }
            _ => unreachable!(),
        }
        let output = command.output().unwrap();
        assert!(!output.status.success());
        assert!(!fixture.log().contains("<attach-session>"));
        if failure == "creation" || failure == "missing_id" {
            assert!(!fixture.log().contains("<set-option>"));
        }
    }
}

#[test]
fn propagates_attach_failure() {
    let fixture = Fixture::new();
    let output = fixture
        .command()
        .env("SELECTION", "session\t$1\tname")
        .env("CONNECT_FAIL", "7")
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(7));
}

#[test]
fn repo_reload_callback_quotes_config_paths_with_spaces_and_apostrophes() {
    let fixture = Fixture::new();
    let output = fixture
        .command()
        .env("RUN_RELOAD", "1")
        .env("REPOS", "/code/org/repo\n")
        .output()
        .unwrap();
    success(&output);
    assert!(
        fs::read_to_string(fixture.root.join("reload.output"))
            .unwrap()
            .contains("repo\t/code/org/repo")
    );
}

#[test]
fn kill_callback_passes_session_id_as_literal_argument_without_opening_selector() {
    let fixture = Fixture::new();
    let id = "$1; touch injected";
    let output = fixture
        .command()
        .args(["kill-session", id])
        .output()
        .unwrap();
    success(&output);
    assert_eq!(fixture.log(), format!("<kill-session><-t><{id}>\n"));
    assert!(!fixture.root.join("fzf.args").exists());
    assert!(!fixture.root.join("injected").exists());
}
