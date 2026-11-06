#!/usr/bin/env bash
set -euo pipefail

test_root=$(realpath "$(mktemp -d)")
trap 'rm -rf "$test_root"' EXIT
export HERDR_ENV=1
export HERDR_SOCKET_PATH="$test_root/herdr.sock"
export HERDR_WORKSPACE_ID=workspace-test HERDR_TAB_ID=tab-test HERDR_PANE_ID=main-test
export TEST_HERDR_MOCK="$test_root/mock-herdr.sh"
unset HERDR_BIN_PATH

cat >"$TEST_HERDR_MOCK" <<'EOF'
set -euo pipefail
printf '%s\n' "$*" >>"$TEST_HERDR_LOG"
case "$1 $2" in
  'pane current')
    printf '%s\n' '{"result":{"pane":{"agent":"pi"}}}'
    ;;
  'pane layout')
    printf '%s\n' '{"result":{"layout":{"panes":[{"pane_id":"main-test","rect":{"width":120,"height":30}}]}}}'
    ;;
  'pane split')
    touch "$TEST_HERDR_PANE"
    printf '%s\n' '{"result":{"pane":{"pane_id":"agent-test"}}}'
    ;;
  'agent start')
    [[ "$3" == analyst ]]
    printf '%s\n' '{"result":{}}'
    ;;
  'pane list')
    if [[ -f "$TEST_HERDR_PANE" ]]; then
      printf '%s\n' '{"result":{"panes":[{"pane_id":"agent-test","tab_id":"tab-test","agent":"pi","agent_status":"idle"}]}}'
    else
      printf '%s\n' '{"result":{"panes":[]}}'
    fi
    ;;
  'pane close')
    [[ "$3" == agent-test ]]
    rm "$TEST_HERDR_PANE"
    printf '%s\n' '{"result":{}}'
    ;;
  *)
    printf 'Unexpected Herdr command: %s\n' "$*" >&2
    exit 1
    ;;
esac
EOF

fail() {
	printf 'herdr-subagents regression: %s\n' "$*" >&2
	exit 1
}

assert_equal() {
	[[ "$1" == "$2" ]] || fail "$3: expected '$1', got '$2'"
}

session_key=$(printf '%s' "$HERDR_SOCKET_PATH" | sha256sum | cut -c1-16)
context_key=$(printf '%s' "$HERDR_WORKSPACE_ID:$HERDR_TAB_ID:$HERDR_PANE_ID" | sha256sum | cut -c1-16)

new_case() {
	export XDG_RUNTIME_DIR="$test_root/$1"
	mkdir -m 700 "$XDG_RUNTIME_DIR"
	export TEST_HERDR_LOG="$XDG_RUNTIME_DIR/herdr.log"
	export TEST_HERDR_PANE="$XDG_RUNTIME_DIR/pane"
	runtime_root="$XDG_RUNTIME_DIR/herdr-subagents"
	state_dir="$runtime_root/$session_key"
	manifest="$state_dir/$context_key.json"
}

expect_refused() {
	if "$HERDR_SUBAGENTS_SCRIPT" "$@" >"$XDG_RUNTIME_DIR/output" 2>"$XDG_RUNTIME_DIR/error"; then
		fail "accepted unsafe state for $*"
	fi
	[[ ! -e "$TEST_HERDR_LOG" ]] || fail 'unsafe state reached Herdr'
}

new_case symlink-root
target="$test_root/root-target"
mkdir -m 700 "$target"
ln -s "$target" "$runtime_root"
expect_refused start analyst=pi
[[ ! -e "$target/$session_key" ]] || fail 'followed the root directory symlink'

new_case symlink-session
mkdir -m 700 "$runtime_root"
target="$test_root/session-target"
mkdir -m 700 "$target"
ln -s "$target" "$state_dir"
expect_refused start analyst=pi
[[ ! -e "$target/$context_key.json" ]] || fail 'followed the session directory symlink'

new_case public-root
mkdir -m 755 "$runtime_root"
expect_refused start analyst=pi
assert_equal 755 "$(stat -c %a "$runtime_root")" 'preserve an unsafe existing root'

new_case public-session
mkdir -m 700 "$runtime_root"
mkdir -m 755 "$state_dir"
expect_refused start analyst=pi
assert_equal 755 "$(stat -c %a "$state_dir")" 'preserve an unsafe existing session'

new_case symlink-manifest
mkdir -m 700 "$runtime_root" "$state_dir"
victim="$test_root/manifest-victim"
jq -n --arg workspace "$HERDR_WORKSPACE_ID" --arg tab "$HERDR_TAB_ID" --arg main "$HERDR_PANE_ID" \
	'{workspace_id: $workspace, tab_id: $tab, main_pane_id: $main, agents: []}' >"$victim"
cp "$victim" "$victim.original"
ln -s "$victim" "$manifest"
expect_refused status
expect_refused cleanup
expect_refused start analyst=pi
cmp "$victim.original" "$victim" || fail 'changed a symlinked manifest target'
[[ -L "$manifest" ]] || fail 'replaced the symlinked manifest'

new_case lifecycle
"$HERDR_SUBAGENTS_SCRIPT" help >/dev/null
victim="$test_root/temporary-victim"
printf '%s\n' 'keep this file unchanged' >"$victim"
ln -s "$victim" "$manifest.tmp"
start_code=0
"$HERDR_SUBAGENTS_SCRIPT" start analyst=pi >"$XDG_RUNTIME_DIR/start.json" || start_code=$?
assert_equal 'keep this file unchanged' "$(cat "$victim")" 'preserve a legacy temporary symlink target'
assert_equal 0 "$start_code" 'start with a poisoned legacy temporary path'
[[ -L "$manifest.tmp" ]] || fail 'followed or replaced the legacy temporary symlink'
[[ -f "$manifest" && ! -L "$manifest" ]] || fail 'manifest is not a regular file'
assert_equal 700 "$(stat -c %a "$runtime_root")" 'private runtime root'
assert_equal 700 "$(stat -c %a "$state_dir")" 'private session directory'
assert_equal 600 "$(stat -c %a "$manifest")" 'private manifest'
for temporary in "$manifest".??????; do
	[[ ! -e "$temporary" && ! -L "$temporary" ]] || fail 'left a randomized temporary file'
done
jq -e '.state == "awaiting_readiness_check" and (.agents | length) == 1 and .agents[0].started and .agents[0].present and .agents[0].status == "idle"' \
	"$XDG_RUNTIME_DIR/start.json" >/dev/null
"$HERDR_SUBAGENTS_SCRIPT" status >"$XDG_RUNTIME_DIR/status.json"
jq -e '.agents[0].name == "analyst" and .agents[0].present and .agents[0].status == "idle"' \
	"$XDG_RUNTIME_DIR/status.json" >/dev/null
rm "$manifest.tmp"
"$HERDR_SUBAGENTS_SCRIPT" cleanup >"$XDG_RUNTIME_DIR/cleanup.json"
jq -e '.closed == ["agent-test"] and .preserved == []' "$XDG_RUNTIME_DIR/cleanup.json" >/dev/null
[[ ! -e "$manifest" && ! -e "$state_dir" && ! -e "$TEST_HERDR_PANE" ]] || fail 'cleanup retained managed state'

echo 'herdr-subagents regressions passed'
