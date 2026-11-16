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
            "herdr-switcher-{}-{} space's",
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
            "herdr",
            r#"
entry=
if [ "$#" = 0 ]; then
  entry='<>'
else
  for arg in "$@"; do entry="$entry<$arg>"; done
fi
printf '%s\n' "$entry" >> "$CASE_DIR/herdr.log"
case "${1-}:${2-}" in
  status:server)
    if [ "${START_REQUIRED-0}" = 1 ] && [ ! -f "$CASE_DIR/started" ]; then
      printf '{"running":false,"compatible":false}\n'
    else
      printf '%s\n' "${SERVER_STATUS-{\"running\":true,\"compatible\":true}}"
    fi ;;
  server:)
    printf '%s' "$PWD" > "$CASE_DIR/server.cwd"
    printf started > "$CASE_DIR/started" ;;
  workspace:list)
    printf '%s\n' "$WORKSPACES_JSON" ;;
  pane:list)
    if [ "${PANE_FAIL-0}" = 1 ]; then exit 1; fi
    printf '%s\n' "$PANES_JSON" ;;
  workspace:create)
    if [ "${CREATE_FAIL-0}" = 1 ]; then exit 7; fi
    printf '%s\n' "$CREATE_JSON" ;;
  workspace:report-metadata)
    if [ "${METADATA_FAIL-0}" = 1 ]; then exit 8; fi ;;
  workspace:focus)
    if [ "${FOCUS_FAIL-0}" = 1 ]; then exit 9; fi
    printf 'focused\n' ;;
  workspace:close)
    printf 'closed\n' ;;
  :)
    printf '%s' "$PWD" > "$CASE_DIR/attach.cwd"
    printf 'attached\n' ;;
  *) exit 2 ;;
esac
"#,
        );
        fixture.script(
            "ghq",
            r#"
printf '<%s>' "$@" >> "$CASE_DIR/ghq.log"
printf '\n' >> "$CASE_DIR/ghq.log"
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
if [ "${CALL_RELOAD-0}" = 1 ]; then
  prefix='--bind=ctrl-r:reload('
  suffix=')+change-header(Repos/orgs)'
  for arg in "$@"; do
    case "$arg" in
      --bind=ctrl-r:reload*)
        callback="${arg#"$prefix"}"
        callback="${callback%"$suffix"}"
        "$TEST_SHELL" -c "$callback" > "$CASE_DIR/reload.output" || exit 99
        ;;
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

    fn command(&self, attach: bool) -> Command {
        let config = json!({
            "herdr": self.root.join("herdr").to_str().unwrap(),
            "ghq": self.root.join("ghq").to_str().unwrap(),
            "fuzzyFinder": self.root.join("fzf").to_str().unwrap(),
            "includeParentDirectories": true,
            "attach": attach
        });
        let config_path = self.root.join("config space's.json");
        fs::write(&config_path, json::to_string(&config).unwrap()).unwrap();
        let mut command = Command::new(env!("CARGO_BIN_EXE_herdr-switcher"));
        command
            .args(["--config", config_path.to_str().unwrap()])
            .env_remove("HERDR_BIN_PATH")
            // Only the three configured executables and the test shell are
            // available; jq/coreutils/ghq/herdr/fzf from PATH cannot hide a dependency.
            .env("PATH", "")
            .env("CASE_DIR", &self.root)
            .env("TEST_SHELL", &self.shell)
            .env("WORKSPACES_JSON", r#"{"result":{"workspaces":[]}}"#)
            .env("PANES_JSON", r#"{"result":{"panes":[]}}"#)
            .env(
                "CREATE_JSON",
                r#"{"result":{"workspace":{"workspace_id":"created"}}}"#,
            );
        command
    }

    fn repo(&self) -> PathBuf {
        let path = self.root.join("repo space's");
        fs::create_dir(&path).unwrap();
        path.canonicalize().unwrap()
    }

    fn log(&self) -> String {
        fs::read_to_string(self.root.join("herdr.log")).unwrap_or_default()
    }

    fn selected_repo(command: &mut Command, path: &Path) {
        command.env(
            "SELECTION",
            format!(
                "repo\t{}\t{}\trepo space's\n",
                path.display(),
                path.display()
            ),
        );
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
fn repo_targets_need_no_utilities_and_query_ghq_once() {
    let fixture = Fixture::new();
    let output = fixture
        .command(false)
        .arg("repo-targets")
        .env("REPOS", "/code/org/b\n/code/org/a\n/code/org/a\n")
        .output()
        .unwrap();
    success(&output);
    assert_eq!(
        String::from_utf8(output.stdout).unwrap(),
        "repo\t/code/org\t/code/org\torg\nrepo\t/code/org/a\t/code/org/a\ta\nrepo\t/code/org/b\t/code/org/b\tb\n"
    );
    assert_eq!(
        fs::read_to_string(fixture.root.join("ghq.log")).unwrap(),
        "<list><-p>\n"
    );
}

#[test]
fn candidate_helpers_tolerate_unavailable_providers() {
    let fixture = Fixture::new();
    let output = fixture
        .command(false)
        .arg("repo-targets")
        .env("GHQ_CODE", "1")
        .output()
        .unwrap();
    success(&output);
    assert!(output.stdout.is_empty());
    let output = fixture
        .command(false)
        .arg("workspace-targets")
        .env("WORKSPACES_JSON", "not json")
        .output()
        .unwrap();
    success(&output);
    assert!(output.stdout.is_empty());
}

#[test]
fn cancellation_never_focuses_creates_or_attaches() {
    let fixture = Fixture::new();
    let output = fixture
        .command(true)
        .env("FZF_CODE", "130")
        .output()
        .unwrap();
    success(&output);
    let log = fixture.log();
    assert!(!log.contains("<focus>") && !log.contains("<create>") && !log.contains("<>"));
}

#[test]
fn hr_focuses_existing_workspace_then_attaches() {
    let fixture = Fixture::new();
    let output = fixture
        .command(true)
        .env("SELECTION", "workspace\tw1\tlabel\n")
        .output()
        .unwrap();
    success(&output);
    assert_eq!(output.stdout, b"attached\n");
    assert!(fixture.log().ends_with("<workspace><focus><w1>\n<>\n"));
    let args = fs::read_to_string(fixture.root.join("fzf.args")).unwrap();
    assert!(args.contains("ctrl-d:execute("));
}

#[test]
fn switcher_focuses_without_attaching_and_has_no_delete_binding() {
    let fixture = Fixture::new();
    let output = fixture
        .command(false)
        .env(
            "WORKSPACES_JSON",
            r#"{"result":{"workspaces":[{"workspace_id":"w1","label":"label"}]}}"#,
        )
        .env("SELECTION", "workspace\tw1\tlabel\n")
        .output()
        .unwrap();
    success(&output);
    assert_eq!(output.stdout, b"focused\n");
    assert_eq!(fixture.log(), "<workspace><list>\n<workspace><focus><w1>\n");
    let args = fs::read_to_string(fixture.root.join("fzf.args")).unwrap();
    assert!(!args.contains("ctrl-d"));
    assert_eq!(
        fs::read_to_string(fixture.root.join("fzf.input")).unwrap(),
        "workspace\tw1\tlabel\n"
    );
}

#[test]
fn switcher_without_workspaces_starts_with_repositories() {
    let fixture = Fixture::new();
    let output = fixture
        .command(false)
        .env("REPOS", "/code/org/repo\n")
        .env("FZF_CODE", "130")
        .output()
        .unwrap();
    success(&output);
    assert!(
        fs::read_to_string(fixture.root.join("fzf.args"))
            .unwrap()
            .contains("--header=Repos/orgs")
    );
    assert!(
        fs::read_to_string(fixture.root.join("fzf.input"))
            .unwrap()
            .contains("repo\t/code/org/repo")
    );
}

#[test]
fn reload_callbacks_handle_spaces_and_apostrophes_in_config_paths() {
    let fixture = Fixture::new();
    let output = fixture
        .command(true)
        .env("REPOS", "/code/org/repo\n")
        .env("CALL_RELOAD", "1")
        .env("FZF_CODE", "130")
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
fn close_callback_does_not_attach_or_open_a_selector() {
    let fixture = Fixture::new();
    let output = fixture
        .command(true)
        .args(["close-workspace", "w1"])
        .output()
        .unwrap();
    success(&output);
    assert!(output.stdout.is_empty());
    assert_eq!(fixture.log(), "<workspace><close><w1>\n");
    assert!(!fixture.root.join("fzf.args").exists());
}

#[test]
fn creates_workspace_and_reports_canonical_path_without_shell_interpolation() {
    let fixture = Fixture::new();
    let repo = fixture.repo();
    let alias = fixture.root.join("repo link");
    symlink(&repo, &alias).unwrap();
    let mut command = fixture.command(false);
    Fixture::selected_repo(&mut command, &alias);
    let output = command.output().unwrap();
    success(&output);
    let log = fixture.log();
    assert!(log.contains(&format!(
        "<workspace><create><--cwd><{}><--label><repo space's><--focus>",
        repo.display()
    )));
    assert!(log.contains(&format!(
        "<workspace><report-metadata><created><--source><dotfiles><--token><dot_repo_path={}>",
        repo.display()
    )));
    assert!(log.ends_with("<workspace><focus><created>\n"));
    assert!(!log.contains("<server>"));
}

#[test]
fn reuses_workspace_by_token_or_checkout_before_inspecting_panes() {
    for field in ["tokens", "worktree"] {
        let fixture = Fixture::new();
        let repo = fixture.repo();
        let workspace = if field == "tokens" {
            json!({"workspace_id":"existing", "tokens":{"dot_repo_path":repo.to_str().unwrap()}})
        } else {
            json!({"workspace_id":"existing", "worktree":{"checkout_path":repo.to_str().unwrap()}})
        };
        let mut command = fixture.command(false);
        command.env(
            "WORKSPACES_JSON",
            json::to_string(&json!({"result":{"workspaces":[workspace]}})).unwrap(),
        );
        Fixture::selected_repo(&mut command, &repo);
        success(&command.output().unwrap());
        let log = fixture.log();
        assert!(!log.contains("<create>") && !log.contains("<pane>"));
        assert!(log.contains("<report-metadata><existing>"));
    }
}

#[test]
fn adopts_matching_pane_only_for_workspaces_without_a_repo_token() {
    let fixture = Fixture::new();
    let repo = fixture.repo();
    let mut command = fixture.command(false);
    command
        .env(
            "WORKSPACES_JSON",
            r#"{"result":{"workspaces":[
            {"workspace_id":"owned","tokens":{"dot_repo_path":"/different"}},
            {"workspace_id":"adoptable","tokens":{"dot_repo_path":null}}
        ]}}"#,
        )
        .env(
            "PANES_JSON",
            json::to_string(&json!({"result":{"panes":[{"cwd":repo.to_str().unwrap()}]}})).unwrap(),
        );
    Fixture::selected_repo(&mut command, &repo);
    success(&command.output().unwrap());
    let log = fixture.log();
    assert!(!log.contains("<--workspace><owned>") && !log.contains("<create>"));
    assert!(log.contains("<pane><list><--workspace><adoptable>"));
    assert!(log.contains("<report-metadata><adoptable>"));
}

#[test]
fn failed_pane_lookup_does_not_prevent_workspace_creation() {
    let fixture = Fixture::new();
    let repo = fixture.repo();
    let mut command = fixture.command(false);
    command
        .env(
            "WORKSPACES_JSON",
            r#"{"result":{"workspaces":[{"workspace_id":"gone"}]}}"#,
        )
        .env("PANE_FAIL", "1");
    Fixture::selected_repo(&mut command, &repo);
    success(&command.output().unwrap());
    assert!(fixture.log().contains("<workspace><create>"));
}

#[test]
fn hr_bootstraps_server_before_opening_repo_then_attaches() {
    let fixture = Fixture::new();
    let repo = fixture.repo();
    let mut command = fixture.command(true);
    command.env("START_REQUIRED", "1");
    Fixture::selected_repo(&mut command, &repo);
    let output = command.output().unwrap();
    success(&output);
    let log = fixture.log();
    assert!(fixture.root.join("started").exists());
    assert_eq!(
        fs::read_to_string(fixture.root.join("server.cwd")).unwrap(),
        repo.to_str().unwrap()
    );
    assert_eq!(
        fs::read_to_string(fixture.root.join("attach.cwd")).unwrap(),
        repo.to_str().unwrap()
    );
    assert!(log.find("<server>\n").unwrap() < log.find("<workspace><create>").unwrap());
    assert!(log.ends_with("<workspace><focus><created>\n<>\n"));
    assert_eq!(output.stdout, b"attached\n");
}

#[test]
fn malformed_create_response_and_mutation_failures_stop_followup_actions() {
    for failure in ["missing_id", "create", "metadata", "focus"] {
        let fixture = Fixture::new();
        let repo = fixture.repo();
        let mut command = fixture.command(true);
        Fixture::selected_repo(&mut command, &repo);
        match failure {
            "missing_id" => {
                command.env("CREATE_JSON", "{}");
            }
            "create" => {
                command.env("CREATE_FAIL", "1");
            }
            "metadata" => {
                command.env("METADATA_FAIL", "1");
            }
            "focus" => {
                command.env("FOCUS_FAIL", "1");
            }
            _ => unreachable!(),
        }
        let output = command.output().unwrap();
        assert!(!output.status.success());
        let log = fixture.log();
        assert!(!log.contains("\n<>\n"));
        if failure != "focus" {
            assert!(!log.contains("<workspace><focus>"));
        }
    }
}

#[test]
fn hr_times_out_without_creating_or_attaching() {
    let fixture = Fixture::new();
    let repo = fixture.repo();
    let mut command = fixture.command(true);
    command.env("SERVER_STATUS", r#"{"running":true,"compatible":false}"#);
    Fixture::selected_repo(&mut command, &repo);
    let output = command.output().unwrap();
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("timed out"));
    let log = fixture.log();
    assert!(!log.contains("<workspace><create>") && !log.contains("\n<>\n"));
}

#[test]
fn invalid_repo_selection_does_not_start_server_or_attach() {
    let fixture = Fixture::new();
    let mut command = fixture.command(true);
    Fixture::selected_repo(&mut command, &fixture.root.join("missing"));
    success(&command.output().unwrap());
    let log = fixture.log();
    assert!(
        !log.contains("<server>\n")
            && !log.contains("<workspace><create>")
            && !log.contains("\n<>\n")
    );
}

#[test]
fn honors_herdr_bin_path_override() {
    let fixture = Fixture::new();
    fixture.script("override", "printf 'override\\n'\n");
    let output = fixture
        .command(false)
        .arg("workspace-targets")
        .env("HERDR_BIN_PATH", fixture.root.join("override"))
        .output()
        .unwrap();
    success(&output);
    assert!(fixture.log().is_empty());
    assert!(output.stdout.is_empty());
}
