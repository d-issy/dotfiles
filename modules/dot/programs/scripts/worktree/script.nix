{
  cfg,
  fuzzyFinderCommand,
  lib,
  pkgs,
}:

let
  piModelArg = lib.optionalString (cfg.model != null) ''
    args+=(--model ${lib.escapeShellArg cfg.model})
  '';
  piThinkingArg = lib.optionalString (cfg.thinking != null) ''
    args+=(--thinking ${lib.escapeShellArg cfg.thinking})
  '';
  fuzzyFinder = lib.escapeShellArg fuzzyFinderCommand;
in
''
  if [[ -n "''${WORKTREE_CALLER_PWD:-}" ]]; then
  	cd "$WORKTREE_CALLER_PWD"
  fi

  VERSION="0.1.0"
  STATE_SUBDIR="worktree/create"

  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[0;33m'
  BLUE=$'\033[0;34m'
  RESET=$'\033[0m'

  warn() { printf '%sWarning:%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
  die() {
  	printf '%sError:%s %s\n' "$RED" "$RESET" "$*" >&2
  	exit 1
  }

  show_help() {
  	${pkgs.coreutils}/bin/cat <<'EOF'
  worktree - personal git worktree helper

  Usage:
    worktree create [--base <ref>]
    worktree create --finish
    worktree list
    worktree status
    worktree switch [<query>]
    worktree switch --pr [<number>]
    worktree rename [<new-branch>]
    worktree prune [-f|--force]
    worktree delete [--keep-branch]
    worktree delete [--keep-branch] --current
    worktree delete [--keep-branch] .
    worktree delete [--keep-branch] <name>

  Commands:
    create        Create a new worktree. Moves staged changes when present.
    list          List git worktrees and their tmux windows.
    status        Show pending create / PR status for the current worktree.
    switch        Switch to an existing worktree, or open a GitHub PR worktree.
    rename        Rename the current branch, worktree directory, and tmux window.
    prune         Delete merged local branches and their worktrees.
    delete        Delete a worktree directory and optionally its local branch.

  Options:
    -h, --help    Show help
    -v, --version Show version
  EOF
  }

  show_create_help() {
  	${pkgs.coreutils}/bin/cat <<'EOF'
  Usage:
    worktree create [--base <ref>]
    worktree create --finish

  Creates a sibling git worktree directory.

  With staged changes:
    - Uses Pi to generate branch/window names.
    - Applies the staged diff to the new worktree as unstaged changes.
    - Removes the original staged changes after a clean copy.
    - If cleanup cannot be done safely, keeps pending state for
      `worktree create --finish`.

  Without staged changes:
    - Generates a random worktree/<three-word-petname> branch.
    - Asks for confirmation with [y/N].

  Options:
    --base <ref>  Base ref for the new branch. Defaults to origin/HEAD,
                  then upstream, then HEAD.
    --finish      Finish a pending staged-change create operation.
    -h, --help    Show this help.
  EOF
  }

  show_list_help() {
  	${pkgs.coreutils}/bin/cat <<'EOF'
  Usage:
    worktree list

  Lists git worktrees in a table.

  Columns:
    Branch   Local branch name.
    Window   Existing tmux window name associated by @worktree_path, or -.
    Managed  yes if this command can delete it; no for the main checkout or
             detached/branchless worktrees.
    Path     Worktree directory.

  The default branch worktree is shown first. Others are sorted by branch name.
  EOF
  }

  show_status_help() {
  	${pkgs.coreutils}/bin/cat <<'EOF'
  Usage:
    worktree status

  Shows pending `worktree create` state and basic PR worktree information for
  the current worktree.
  EOF
  }

  show_switch_help() {
  	${pkgs.coreutils}/bin/cat <<'EOF'
  Usage:
    worktree switch [<query>]
    worktree switch --pr [<number>]

  Switches to a worktree. Inside tmux, selects or opens a tmux window. Outside
  tmux, asks the shell wrapper to cd to the target path.

  Options:
    --pr [number]  Open or switch to a GitHub PR worktree. If number is omitted,
                   choose a PR with the fuzzy finder.
    -h, --help     Show this help.
  EOF
  }

  show_rename_help() {
  	${pkgs.coreutils}/bin/cat <<'EOF'
  Usage:
    worktree rename
    worktree rename <new-branch>

  Renames the current local branch, worktree directory, and tmux window.

  Without <new-branch>, uses Pi to generate branch/window names from current
  changes and asks for confirmation.
  EOF
  }

  show_prune_help() {
  	${pkgs.coreutils}/bin/cat <<'EOF'
  Usage:
    worktree prune
    worktree prune -f
    worktree prune --force

  Deletes local branches already merged into the base branch, and removes their
  worktrees when present.

  Base selection:
    Uses origin/HEAD, then the current branch upstream, then HEAD. The command
    does not fetch.

  Safety:
    - Never deletes remote branches or GitHub PRs.
    - Detects squash-merged branches via GitHub PR state when available.
    - Never deletes the default branch.
    - Skips the current worktree.
    - Skips dirty worktrees unless -f/--force is used.
    - Shows targets before pruning.

  Options:
    -f, --force  Also delete dirty merged worktrees.
    -h, --help   Show this help.
  EOF
  }

  show_delete_help() {
  	${pkgs.coreutils}/bin/cat <<'EOF'
  Usage:
    worktree delete [--keep-branch]
    worktree delete [--keep-branch] --current
    worktree delete [--keep-branch] .
    worktree delete [--keep-branch] <name>

  Deletes the worktree directory and, by default, its local branch.

  Target selection:
    worktree delete            Choose a managed worktree with the fuzzy finder.
    worktree delete --current  Delete the current worktree.
    worktree delete .          Delete the current worktree.
    worktree delete <name>     Match exactly by branch name, path basename, or
                               tmux window name.

  Options:
    --keep-branch              Delete only the worktree directory and keep the
                               local branch.

  Safety:
    - Always shows Branch, Path, and Window before asking Delete? [y/N].
    - Refuses to delete the main checkout.
    - Refuses detached/branchless worktrees.
    - Local changes require confirmation and are discarded only on y.
    - Force-deletes the local branch with git branch -D unless --keep-branch is used.
    - Never deletes remote branches or GitHub PRs.
  EOF
  }

  require_git_repo() {
  	${pkgs.git}/bin/git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not in a git repository"
  }

  repo_root() { ${pkgs.git}/bin/git rev-parse --show-toplevel; }
  common_git_dir() { ${pkgs.git}/bin/git rev-parse --path-format=absolute --git-common-dir; }
  current_branch() { ${pkgs.git}/bin/git branch --show-current; }

  canonical_path() {
  	${pkgs.coreutils}/bin/realpath "$1" 2>/dev/null || printf '%s\n' "$1"
  }

  managed_repo_root() {
  	local common
  	common="$(common_git_dir)"
  	if [[ "$(${pkgs.coreutils}/bin/basename "$common")" == ".git" ]]; then
  		${pkgs.coreutils}/bin/dirname "$common"
  	else
  		repo_root
  	fi
  }

  state_root() {
  	printf '%s/%s\n' "$(common_git_dir)" "$STATE_SUBDIR"
  }

  hash_text() {
  	${pkgs.git}/bin/git hash-object --stdin <<<"$1"
  }

  state_dir_for_target() {
  	local target="$1"
  	printf '%s/%s\n' "$(state_root)" "$(hash_text "$target")"
  }

  find_state_for_current_target() {
  	local root target state
  	root="$(repo_root)"
  	target="$root"
  	state="$(state_dir_for_target "$target")"
  	if [[ -f "$state/target_path" ]] && [[ "$(<"$state/target_path")" == "$target" ]]; then
  		printf '%s\n' "$state"
  		return 0
  	fi

  	if [[ -d "$(state_root)" ]]; then
  		while IFS= read -r -d ''' candidate; do
  			if [[ -f "$candidate/target_path" ]] && [[ "$(<"$candidate/target_path")" == "$target" ]]; then
  				printf '%s\n' "$candidate"
  				return 0
  			fi
  		done < <(${pkgs.fd}/bin/fd . "$(state_root)" --type directory --min-depth 1 --max-depth 1 --print0 2>/dev/null)
  	fi
  	return 1
  }

  sanitize_path_component() {
  	printf '%s' "$1" |
  		${pkgs.gnused}/bin/sed -E 's#[/\\]+#-#g; s#[^A-Za-z0-9._-]+#-#g; s#-+#-#g; s#^-+##; s#-+$##'
  }

  short_window_from_branch() {
  	local branch="$1" window
  	window="''${branch##*/}"
  	window="$(sanitize_path_component "$window")"
  	if [[ ''${#window} -gt 24 ]]; then
  		window="''${window:0:24}"
  		window="''${window%-}"
  	fi
  	[[ -n "$window" ]] || window="worktree"
  	printf '%s\n' "$window"
  }

  repo_sibling_path_for_branch() {
  	local branch="$1" root parent repo safe
  	root="$(managed_repo_root)"
  	parent="$(${pkgs.coreutils}/bin/dirname "$root")"
  	repo="$(${pkgs.coreutils}/bin/basename "$root")"
  	safe="$(sanitize_path_component "$branch")"
  	printf '%s/%s.%s\n' "$parent" "$repo" "$safe"
  }

  repo_sibling_path_for_pr() {
  	local number="$1" root parent repo
  	root="$(managed_repo_root)"
  	parent="$(${pkgs.coreutils}/bin/dirname "$root")"
  	repo="$(${pkgs.coreutils}/bin/basename "$root")"
  	printf '%s/%s.pr-%s\n' "$parent" "$repo" "$number"
  }

  branch_window_config_key() {
  	printf 'branch.%s.worktree-window\n' "$1"
  }

  legacy_branch_window_config_key() {
  	printf 'branch."%s".worktree-window\n' "$1"
  }

  saved_window_for_branch() {
  	local branch="$1" window
  	[[ -n "$branch" && "$branch" != detached ]] || return 1
  	window="$(${pkgs.git}/bin/git config --get "$(branch_window_config_key "$branch")" 2>/dev/null || true)"
  	if [[ -z "$window" ]]; then
  		window="$(${pkgs.git}/bin/git config --get "$(legacy_branch_window_config_key "$branch")" 2>/dev/null || true)"
  	fi
  	[[ -n "$window" ]] || return 1
  	printf '%s\n' "$window"
  }

  set_saved_window_for_branch() {
  	local branch="$1" window="$2"
  	[[ -n "$branch" && -n "$window" ]] || return 0
  	${pkgs.git}/bin/git config "$(branch_window_config_key "$branch")" "$window"
  	${pkgs.git}/bin/git config --unset-all "$(legacy_branch_window_config_key "$branch")" >/dev/null 2>&1 || true
  }

  unset_saved_window_for_branch() {
  	local branch="$1"
  	[[ -n "$branch" ]] || return 0
  	${pkgs.git}/bin/git config --unset-all "$(branch_window_config_key "$branch")" >/dev/null 2>&1 || true
  	${pkgs.git}/bin/git config --unset-all "$(legacy_branch_window_config_key "$branch")" >/dev/null 2>&1 || true
  }

  branch_from_window_config_key() {
  	local key="$1" branch
  	branch="''${key#branch.}"
  	branch="''${branch%.worktree-window}"
  	branch="''${branch#\"}"
  	branch="''${branch%\"}"
  	printf '%s\n' "$branch"
  }

  cleanup_stale_saved_windows() {
  	local key branch
  	while IFS= read -r key; do
  		[[ -n "$key" ]] || continue
  		branch="$(branch_from_window_config_key "$key")"
  		if ! branch_exists "$branch"; then
  			${pkgs.git}/bin/git config --remove-section "branch.$branch" >/dev/null 2>&1 || true
  			${pkgs.git}/bin/git config --remove-section "branch.\"$branch\"" >/dev/null 2>&1 || true
  			${pkgs.git}/bin/git config --unset-all "$key" >/dev/null 2>&1 || true
  			printf '%sCleaned:%s stale window config: %s\n' "$GREEN" "$RESET" "$key"
  		fi
  	done < <(${pkgs.git}/bin/git config --get-regexp 'worktree-window$' 2>/dev/null | ${pkgs.gawk}/bin/awk '$1 ~ /^branch\..*\.worktree-window$/ { print $1 }' || true)
  }

  desired_window_for_worktree() {
  	local path="$1" branch="$2" window base
  	window="$(saved_window_for_branch "$branch" 2>/dev/null || true)"
  	if [[ -n "$window" ]]; then
  		printf '%s\n' "$window"
  		return
  	fi

  	base="$(${pkgs.coreutils}/bin/basename "$path")"
  	if [[ "$base" =~ \.pr-([0-9]+)$ ]]; then
  		printf 'pr-%s\n' "''${BASH_REMATCH[1]}"
  		return
  	fi

  	if [[ -n "$branch" && "$branch" != detached ]]; then
  		short_window_from_branch "$branch"
  	else
  		short_window_from_branch "$base"
  	fi
  }

  branch_exists() {
  	${pkgs.git}/bin/git show-ref --verify --quiet "refs/heads/$1"
  }

  branch_checked_out_path() {
  	local branch="$1"
  	${pkgs.git}/bin/git worktree list --porcelain | ${pkgs.gawk}/bin/awk -v branch="refs/heads/$branch" '
      /^worktree / { path=substr($0, 10) }
      /^branch / && substr($0, 8) == branch { print path; exit }
    '
  }

  branch_upstream_gone() {
  	local branch="$1" track
  	track="$(${pkgs.git}/bin/git for-each-ref --format='%(upstream:track)' "refs/heads/$branch" 2>/dev/null || true)"
  	[[ "$track" == "[gone]" ]]
  }

  branch_patch_merged() {
  	local base="$1" branch="$2" cherry
  	cherry="$(${pkgs.git}/bin/git cherry "$base" "$branch" 2>/dev/null || true)"
  	[[ -n "$cherry" ]] || return 1
  	printf '%s\n' "$cherry" | ${pkgs.gawk}/bin/awk '$1 == "+" { exit 1 }'
  }

  branch_github_pr_merged() {
    local branch="$1" info state head_oid local_oid
    info="$(${pkgs.gh}/bin/gh pr view "$branch" --json state,headRefOid --jq '[.state, .headRefOid] | @tsv' 2>/dev/null || true)"
    [[ -n "$info" ]] || return 1
    IFS=$'\t' read -r state head_oid <<<"$info"
    [[ "$state" == MERGED && -n "$head_oid" ]] || return 1
    local_oid="$(${pkgs.git}/bin/git rev-parse --verify "$branch^{commit}" 2>/dev/null || true)"
    [[ "$local_oid" == "$head_oid" ]]
  }

  list_prune_branches() {
  	local base="$1" branch
  	while IFS= read -r branch; do
  		[[ -n "$branch" ]] || continue
  		if ${pkgs.git}/bin/git merge-base --is-ancestor "$branch" "$base" 2>/dev/null; then
  			printf '%s\n' "$branch"
      elif branch_upstream_gone "$branch"; then
        if branch_patch_merged "$base" "$branch" || branch_github_pr_merged "$branch"; then
          printf '%s\n' "$branch"
        fi
  		fi
  	done < <(${pkgs.git}/bin/git for-each-ref --format='%(refname:short)' refs/heads)
  }

  validate_new_branch_and_path() {
  	local branch="$1" path="$2"
  	${pkgs.git}/bin/git check-ref-format --branch "$branch" >/dev/null || die "Invalid branch name: $branch"
  	if branch_exists "$branch"; then
  		die "Branch already exists: $branch"
  	fi
  	if [[ -e "$path" ]]; then
  		die "Path already exists: $path"
  	fi
  }

  default_base_ref() {
  	local ref current

  	# Prefer the remote default branch when available.
  	ref="$(${pkgs.git}/bin/git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  	if [[ -n "$ref" ]]; then
  		printf '%s\n' "$ref"
  		return
  	fi

  	# Local-only repositories do not have origin/HEAD. If the current branch
  	# tracks any upstream, use that; otherwise branch from current HEAD.
  	current="$(current_branch)"
  	if [[ -n "$current" ]]; then
  		ref="$(${pkgs.git}/bin/git rev-parse --abbrev-ref --symbolic-full-name "@{upstream}" 2>/dev/null || true)"
  		if [[ -n "$ref" ]]; then
  			printf '%s\n' "$ref"
  			return
  		fi
  	fi

  	printf 'HEAD\n'
  }

  has_staged_changes() {
  	! ${pkgs.git}/bin/git diff --cached --quiet --exit-code
  }

  has_any_diff_for_names() {
  	! ${pkgs.git}/bin/git diff --quiet --exit-code HEAD || ! ${pkgs.git}/bin/git diff --cached --quiet --exit-code
  }

  run_pi_from_stdin() {
  	command -v pi >/dev/null 2>&1 || die "pi CLI not found"
  	local tmpfile tmperr
  	tmpfile="$(${pkgs.coreutils}/bin/mktemp)"
  	tmperr="$(${pkgs.coreutils}/bin/mktemp)"
  	trap '${pkgs.coreutils}/bin/rm -f "$tmpfile" "$tmperr"' RETURN

  	local args=(--print)
  	${piModelArg}
  	${piThinkingArg}
  	args+=(--no-session --no-tools --no-extensions --no-skills --no-prompt-templates --no-context-files)

  	if ! pi "''${args[@]}" >"$tmpfile" 2>"$tmperr"; then
  		${pkgs.coreutils}/bin/cat "$tmperr" >&2 || true
  		return 1
  	fi
  	${pkgs.coreutils}/bin/cat "$tmpfile"
  }

  generate_names_from_input() {
  	local mode="$1"
  	local prompt output branch window
  	if [[ "$mode" == "staged" ]]; then
  		prompt='Generate names for a git worktree task from the staged changes.

  Return ONLY compact JSON with this shape:
  {"branch":"kebab-case-branch-name","window":"short-window-name"}

  Rules:
  - branch must be a valid git branch name suitable for a PR.
  - Do not add generic prefixes like feature/, fix/, worktree/ unless the project diff clearly indicates that convention.
  - branch: kebab-case, descriptive, preferably 2-5 words.
  - window: short for tmux status, kebab-case, preferably 1-3 words and under 18 chars.
  - No markdown, no explanation.

  Staged changes:'
  		output=$({
  			printf '%s\n\n' "$prompt"
  			${pkgs.git}/bin/git diff --cached --stat
  			printf '\n'
  			${pkgs.git}/bin/git diff --cached
  		} | run_pi_from_stdin)
  	else
  		prompt='Generate a new git branch name and short tmux window name from the current repository changes.

  Return ONLY compact JSON with this shape:
  {"branch":"kebab-case-branch-name","window":"short-window-name"}

  Rules:
  - branch must be a valid git branch name suitable for a PR.
  - Do not add generic prefixes like feature/, fix/, worktree/ unless the project diff clearly indicates that convention.
  - branch: kebab-case, descriptive, preferably 2-5 words.
  - window: short for tmux status, kebab-case, preferably 1-3 words and under 18 chars.
  - No markdown, no explanation.

  Current changes:'
  		output=$({
  			printf '%s\n\n' "$prompt"
  			${pkgs.git}/bin/git diff --stat HEAD
  			printf '\n'
  			${pkgs.git}/bin/git diff HEAD
  			printf '\n'
  			${pkgs.git}/bin/git diff --cached --stat
  			printf '\n'
  			${pkgs.git}/bin/git diff --cached
  		} | run_pi_from_stdin)
  	fi

  	branch=$(printf '%s' "$output" | ${pkgs.jq}/bin/jq -er '.branch' 2>/dev/null || true)
  	window=$(printf '%s' "$output" | ${pkgs.jq}/bin/jq -er '.window' 2>/dev/null || true)
  	[[ -n "$branch" && -n "$window" ]] || die "Could not parse generated names from Pi output: $output"
  	printf '%s\t%s\n' "$branch" "$window"
  }

  confirm_generated_names() {
  	local mode="$1" action="$2" branch="$3" window="$4" response new_branch new_window generated
  	while true; do
  		printf '\n%sBranch:%s %s\n' "$BLUE" "$RESET" "$branch" >/dev/tty
  		printf '%sWindow:%s %s\n\n' "$BLUE" "$RESET" "$window" >/dev/tty
  		read -r -p "$action? [Y/n/e/r] " response </dev/tty
  		response="''${response:-Y}"
  		case "$response" in
  		[Yy]*)
  			printf '%s\t%s\n' "$branch" "$window"
  			return 0
  			;;
  		[Nn]*)
  			die "Cancelled"
  			;;
  		[Ee]*)
  			read -r -p "Branch [$branch]: " new_branch </dev/tty
  			read -r -p "Window [$window]: " new_window </dev/tty
  			branch="''${new_branch:-$branch}"
  			window="''${new_window:-$window}"
  			;;
  		[Rr]*)
  			generated="$(generate_names_from_input "$mode")"
  			branch="''${generated%%$'\t'*}"
  			window="''${generated#*$'\t'}"
  			;;
  		*)
  			printf 'Please answer Y, n, e, or r.\n' >/dev/tty
  			;;
  		esac
  	done
  }

  generate_random_petname() {
  	${pkgs.rust-petname}/bin/petname --words 3 --separator -
  }

  make_unique_random_names() {
  	local name branch path
  	for _ in {1..10}; do
  		name="$(generate_random_petname)"
  		branch="worktree/$name"
  		path="$(repo_sibling_path_for_branch "$branch")"
  		if ! branch_exists "$branch" && [[ ! -e "$path" ]]; then
  			printf '%s\t%s\t%s\n' "$branch" "$name" "$path"
  			return 0
  		fi
  	done
  	die "Could not generate a unique random worktree name"
  }

  is_inside_tmux() {
  	[[ -n "''${TMUX:-}" ]] && command -v ${pkgs.tmux}/bin/tmux >/dev/null 2>&1
  }

  tmux_window_for_path() {
  	local path="$1" id opt pane
  	is_inside_tmux || return 1
  	while IFS=$'\t' read -r id opt pane; do
  		if [[ "$opt" == "$path" || "$pane" == "$path" ]]; then
  			printf '%s\n' "$id"
  			return 0
  		fi
  	done < <(${pkgs.tmux}/bin/tmux list-windows -F '#{window_id}	#{@worktree_path}	#{pane_current_path}' 2>/dev/null)
  	return 1
  }

  tmux_window_for_option_path() {
  	local path="$1" id opt
  	is_inside_tmux || return 1
  	while IFS=$'\t' read -r id opt; do
  		if [[ "$opt" == "$path" ]]; then
  			printf '%s\n' "$id"
  			return 0
  		fi
  	done < <(${pkgs.tmux}/bin/tmux list-windows -F '#{window_id}	#{@worktree_path}' 2>/dev/null)
  	return 1
  }

  tmux_window_name_for_path() {
  	local path="$1" name opt
  	is_inside_tmux || return 1
  	while IFS=$'\t' read -r name opt; do
  		if [[ "$opt" == "$path" ]]; then
  			printf '%s\n' "$name"
  			return 0
  		fi
  	done < <(${pkgs.tmux}/bin/tmux list-windows -F '#{window_name}	#{@worktree_path}' 2>/dev/null)
  	return 1
  }

  current_tmux_window_id() {
  	is_inside_tmux || return 1
  	${pkgs.tmux}/bin/tmux display-message -p '#{window_id}' 2>/dev/null
  }

  write_cd_directive() {
  	local path="$1"
  	if [[ -n "''${WORKTREE_CD_FILE:-}" ]]; then
  		printf '%s\n' "$path" >"$WORKTREE_CD_FILE"
  	else
  		printf 'Switch to: %s\n' "$path"
  	fi
  }

  is_main_checkout_path() {
  	local path="$1"
  	[[ "$(canonical_path "$path")" == "$(canonical_path "$(managed_repo_root)")" ]]
  }

  open_path() {
  	local path="$1" window="$2" id
  	if is_inside_tmux; then
  		if is_main_checkout_path "$path"; then
  			if id="$(tmux_window_for_path "$path")"; then
  				${pkgs.tmux}/bin/tmux select-window -t "$id"
  			else
  				${pkgs.tmux}/bin/tmux new-window -c "$path" >/dev/null
  			fi
  			return
  		fi

  		if id="$(tmux_window_for_path "$path")"; then
  			${pkgs.tmux}/bin/tmux select-window -t "$id"
  		else
  			id="$(${pkgs.tmux}/bin/tmux new-window -P -F '#{window_id}' -n "$window" -c "$path")"
  		fi
  		${pkgs.tmux}/bin/tmux rename-window -t "$id" "$window" >/dev/null || true
  		${pkgs.tmux}/bin/tmux set-window-option -t "$id" automatic-rename off >/dev/null || true
  		${pkgs.tmux}/bin/tmux set-window-option -t "$id" allow-rename off >/dev/null || true
  		${pkgs.tmux}/bin/tmux set-window-option -t "$id" @worktree_path "$path" >/dev/null || true
  	else
  		write_cd_directive "$path"
  	fi
  }

  list_worktrees_tsv() {
  	local path="" branch=""
  	while IFS= read -r line || [[ -n "$line" ]]; do
  		if [[ "$line" == worktree\ * ]]; then
  			if [[ -n "$path" ]]; then
  				printf '%s\t%s\n' "''${branch:-detached}" "$path"
  			fi
  			path="''${line#worktree }"
  			branch=""
  		elif [[ "$line" == branch\ refs/heads/* ]]; then
  			branch="''${line#branch refs/heads/}"
  		fi
  	done < <(${pkgs.git}/bin/git worktree list --porcelain)
  	if [[ -n "$path" ]]; then
  		printf '%s\t%s\n' "''${branch:-detached}" "$path"
  	fi
  }

  default_branch_name() {
  	local ref root_branch
  	ref="$(${pkgs.git}/bin/git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  	if [[ -n "$ref" ]]; then
  		printf '%s\n' "''${ref#origin/}"
  		return
  	fi
  	if branch_exists main; then
  		printf 'main\n'
  		return
  	fi
  	if branch_exists master; then
  		printf 'master\n'
  		return
  	fi
  	root_branch="$(${pkgs.git}/bin/git -C "$(managed_repo_root)" branch --show-current 2>/dev/null || true)"
  	if [[ -n "$root_branch" ]]; then
  		printf '%s\n' "$root_branch"
  		return
  	fi
  	current_branch
  }

  list_worktree_records_tsv() {
  	local main_root path branch managed window
  	main_root="$(canonical_path "$(managed_repo_root)")"
  	while IFS=$'\t' read -r branch path; do
  		managed=yes
  		if [[ "$branch" == detached || "$(canonical_path "$path")" == "$main_root" ]]; then
  			managed=no
  		fi
  		window="$(tmux_window_name_for_path "$path" 2>/dev/null || true)"
  		printf '%s\t%s\t%s\t%s\n' "$branch" "''${window:--}" "$managed" "$path"
  	done < <(list_worktrees_tsv)
  }

  managed_worktree_records_tsv() {
  	list_worktree_records_tsv | ${pkgs.gawk}/bin/awk -F '\t' '$3 == "yes" { print }'
  }

  print_worktree_table() {
  	${pkgs.gawk}/bin/awk -F '\t' '
        BEGIN {
          rows[0] = "Branch\tWindow\tManaged\tPath"
          n = 1
          widths[1] = 6; widths[2] = 6; widths[3] = 7; widths[4] = 4
        }
        {
          rows[n] = $0
          for (i = 1; i <= 4; i++) {
            if (length($i) > widths[i]) widths[i] = length($i)
          }
          n++
        }
        END {
          for (r = 0; r < n; r++) {
            split(rows[r], f, "\t")
            printf "%-*s  %-*s  %-*s  %s\n", widths[1], f[1], widths[2], f[2], widths[3], f[3], f[4]
          }
        }
      '
  }

  sorted_worktree_records_tsv() {
  	local default_branch
  	default_branch="$(default_branch_name)"
  	list_worktree_records_tsv | ${pkgs.gawk}/bin/awk -F '\t' -v default_branch="$default_branch" '
        $1 == default_branch { print "0\t\t" $0; next }
        { print "1\t" $1 "\t" $0 }
      ' | ${pkgs.coreutils}/bin/sort -t $'\t' -k1,1 -k2,2 | ${pkgs.coreutils}/bin/cut -f3-
  }

  select_worktree() {
  	local query="''${1:-}" selected matches count
  	if [[ -z "$query" ]]; then
  		selected="$(list_worktrees_tsv | ${fuzzyFinder} --header='Worktrees' --with-nth=1,2)"
  		[[ -n "$selected" ]] || exit 0
  		printf '%s\n' "''${selected#*$'\t'}"
  		return 0
  	fi

  	matches="$(list_worktrees_tsv | ${pkgs.gawk}/bin/awk -F '\t' -v q="$query" '
      $1 == q { print; exact=1 }
      END { if (exact) exit 0 }
    ')"
  	if [[ -z "$matches" ]]; then
  		matches="$(list_worktrees_tsv | ${pkgs.gawk}/bin/awk -F '\t' -v q="$query" '
        index($1, q) || index($2, q) || index($2, "/" q) { print }
      ')"
  	fi

  	count="$(printf '%s\n' "$matches" | ${pkgs.gnused}/bin/sed '/^$/d' | ${pkgs.coreutils}/bin/wc -l | ${pkgs.coreutils}/bin/tr -d ' ')"
  	case "$count" in
  	0) die "No worktree matches: $query" ;;
  	1) printf '%s\n' "''${matches#*$'\t'}" ;;
  	*)
  		selected="$(printf '%s\n' "$matches" | ${fuzzyFinder} --header="Worktrees matching: $query" --with-nth=1,2)"
  		[[ -n "$selected" ]] || exit 0
  		printf '%s\n' "''${selected#*$'\t'}"
  		;;
  	esac
  }

  create_worktree() {
  	local base="$1" branch="$2" window="$3" target="$4"
  	validate_new_branch_and_path "$branch" "$target"
  	${pkgs.git}/bin/git worktree add -b "$branch" "$target" "$base"
  	set_saved_window_for_branch "$branch" "$window"
  	open_path "$target" "$window"
  }

  backup_patch_paths() {
  	local source="$1" backup_dir="$2" path dir
  	local paths="$backup_dir/paths" manifest="$backup_dir/manifest" files="$backup_dir/files"
  	: >"$manifest"
  	${pkgs.git}/bin/git -C "$source" diff --cached --name-only -z >"$paths"
  	while IFS= read -r -d ''' path; do
  		dir="''${path%/*}"
  		[[ "$dir" != "$path" ]] || dir="."
  		if [[ -e "$source/$path" || -L "$source/$path" ]]; then
  			${pkgs.coreutils}/bin/mkdir -p "$files/$dir"
  			${pkgs.coreutils}/bin/cp -a "$source/$path" "$files/$path"
  			printf '1\0%s\0' "$path" >>"$manifest"
  		else
  			printf '0\0%s\0' "$path" >>"$manifest"
  		fi
  	done <"$paths"
  }

  restore_patch_paths() {
  	local source="$1" backup_dir="$2" present path dir
  	local manifest="$backup_dir/manifest" files="$backup_dir/files"
  	while IFS= read -r -d ''' present && IFS= read -r -d ''' path; do
  		dir="''${path%/*}"
  		[[ "$dir" != "$path" ]] || dir="."
  		${pkgs.coreutils}/bin/rm -rf -- "''${source:?}/$path"
  		if [[ "$present" == 1 ]]; then
  			${pkgs.coreutils}/bin/mkdir -p "$source/$dir"
  			${pkgs.coreutils}/bin/cp -a "$files/$path" "$source/$path"
  		fi
  	done <"$manifest"
  }

  reverse_patch_with_gnu_patch() {
  	local source="$1" patch="$2" backup_dir reject patch_status=0
  	backup_dir="$(${pkgs.coreutils}/bin/mktemp -d)"
  	reject="$backup_dir/reject"
  	backup_patch_paths "$source" "$backup_dir"

  	(cd "$source" && ${pkgs.patch}/bin/patch --batch --forward -p1 -R --reject-file="$reject" <"$patch") >/dev/null 2>&1 || patch_status=$?
  	if [[ ! -s "$reject" ]]; then
  		${pkgs.coreutils}/bin/rm -rf "$backup_dir"
  		return 0
  	fi

  	restore_patch_paths "$source" "$backup_dir"
  	${pkgs.coreutils}/bin/rm -rf "$backup_dir"
  	return "$patch_status"
  }

  remove_original_patch_from_source() {
  	local source="$1" patch="$2"
  	if [[ ! -d "$source" ]]; then
  		warn "Source worktree no longer exists: $source"
  		return 1
  	fi

  	if ! ${pkgs.git}/bin/git -C "$source" apply -R --cached --check "$patch" >/dev/null 2>&1; then
  		warn "Could not remove original staged changes from index safely. They remain staged in: $source"
  		return 1
  	fi

  	if ${pkgs.git}/bin/git -C "$source" apply -R --check "$patch" >/dev/null 2>&1; then
  		${pkgs.git}/bin/git -C "$source" apply -R "$patch"
  	elif reverse_patch_with_gnu_patch "$source" "$patch"; then
  		:
  	else
  		warn "Could not remove original staged changes from working tree safely. Removing them from index anyway: $source"
  	fi

  	${pkgs.git}/bin/git -C "$source" apply -R --cached "$patch"
  	printf '%sRemoved original staged changes from index.%s\n' "$GREEN" "$RESET"
  }

  cmd_create_finish() {
  	require_git_repo
  	local state source patch ok=true
  	state="$(find_state_for_current_target || true)"
  	[[ -n "$state" ]] || die "No pending create state for this worktree"
  	source="$(<"$state/source_path")"
  	if [[ -f "$state/cleanup_patch" ]]; then
  		patch="$state/cleanup_patch"
  	else
  		patch="$state/patch"
  	fi

  	remove_original_patch_from_source "$source" "$patch" || ok=false

  	${pkgs.coreutils}/bin/rm -rf "$state"
  	if [[ "$ok" == true ]]; then
  		printf '%sFinished worktree create.%s\n' "$GREEN" "$RESET"
  	else
  		printf '%sFinished worktree create with warnings.%s\n' "$YELLOW" "$RESET"
  	fi
  }

  cmd_create() {
  	require_git_repo
  	local base="" finish=false

  	while [[ $# -gt 0 ]]; do
  		case "$1" in
  		--finish)
  			finish=true
  			shift
  			;;
  		--base)
  			[[ $# -ge 2 ]] || die "--base requires a ref"
  			base="$2"
  			shift 2
  			;;
  		-h | --help)
  			show_create_help
  			exit 0
  			;;
  		*)
  			die "Unknown create option: $1"
  			;;
  		esac
  	done

  	if [[ "$finish" == true ]]; then
  		cmd_create_finish
  		return
  	fi

  	if [[ -z "$base" ]]; then
  		base="$(default_base_ref)"
  	fi

  	local source branch window target generated response random patch cleanup_patch state
  	source="$(repo_root)"

  	if has_staged_changes; then
  		patch="$(${pkgs.coreutils}/bin/mktemp)"
  		cleanup_patch="$(${pkgs.coreutils}/bin/mktemp)"
  		${pkgs.git}/bin/git diff --cached --binary >"$patch"
  		${pkgs.git}/bin/git diff --cached --binary -U0 >"$cleanup_patch"
  		generated="$(generate_names_from_input staged)"
  		branch="''${generated%%$'\t'*}"
  		window="''${generated#*$'\t'}"
  		generated="$(confirm_generated_names staged Create "$branch" "$window")"
  		branch="''${generated%%$'\t'*}"
  		window="''${generated#*$'\t'}"
  		target="$(repo_sibling_path_for_branch "$branch")"
  		validate_new_branch_and_path "$branch" "$target"

  		${pkgs.git}/bin/git worktree add -b "$branch" "$target" "$base"
  		set_saved_window_for_branch "$branch" "$window"

  		state="$(state_dir_for_target "$target")"
  		${pkgs.coreutils}/bin/mkdir -p "$state"
  		${pkgs.coreutils}/bin/cp "$patch" "$state/patch"
  		${pkgs.coreutils}/bin/cp "$cleanup_patch" "$state/cleanup_patch"
  		printf '%s\n' "$source" >"$state/source_path"
  		printf '%s\n' "$target" >"$state/target_path"
  		printf '%s\n' "$branch" >"$state/branch"
  		printf '%s\n' "$window" >"$state/window"
  		${pkgs.coreutils}/bin/date -u +%FT%TZ >"$state/created_at"
  		${pkgs.coreutils}/bin/rm -f "$patch" "$cleanup_patch"

  		if ${pkgs.git}/bin/git -C "$target" apply "$state/patch" >/dev/null 2>&1; then
  			printf '%sCopied staged changes to new worktree as unstaged changes.%s\n' "$GREEN" "$RESET"
  			if remove_original_patch_from_source "$source" "$state/cleanup_patch"; then
  				${pkgs.coreutils}/bin/rm -rf "$state"
  			else
  				warn "Original staged changes are still present. After inspecting, run: worktree create --finish"
  			fi
  		else
  			warn "Patch did not apply cleanly in the new worktree. Trying --reject."
  			if ${pkgs.git}/bin/git -C "$target" apply --reject "$state/patch" >/dev/null 2>&1; then
  				warn "Patch applied partially with .rej files. Resolve in the new worktree, then run: worktree create --finish"
  			else
  				warn "Could not apply patch. Patch is saved at: $state/patch"
  			fi
  		fi

  		open_path "$target" "$window"
  	else
  		random="$(make_unique_random_names)"
  		branch="''${random%%$'\t'*}"
  		random="''${random#*$'\t'}"
  		window="''${random%%$'\t'*}"
  		target="''${random#*$'\t'}"

  		printf '\nNo staged changes.\nCreate empty worktree?\n\n' >/dev/tty
  		printf '%sBranch:%s %s\n' "$BLUE" "$RESET" "$branch" >/dev/tty
  		printf '%sWindow:%s %s\n\n' "$BLUE" "$RESET" "$window" >/dev/tty
  		read -r -p "Create? [y/N] " response </dev/tty
  		case "$response" in
  		[Yy]*) create_worktree "$base" "$branch" "$window" "$target" ;;
  		*) die "Cancelled" ;;
  		esac
  	fi
  }

  cmd_status() {
  	require_git_repo
  	while [[ $# -gt 0 ]]; do
  		case "$1" in
  		-h | --help)
  			show_status_help
  			exit 0
  			;;
  		*)
  			die "status does not accept arguments"
  			;;
  		esac
  	done

  	local state root base pr_number printed=false
  	root="$(repo_root)"

  	state="$(find_state_for_current_target || true)"
  	if [[ -n "$state" ]]; then
  		printed=true
  		printf '%sCreate pending%s\n\n' "$BLUE" "$RESET"
  		printf 'Source: %s\n' "$(<"$state/source_path")"
  		printf 'Target: %s\n' "$(<"$state/target_path")"
  		printf 'Branch: %s\n' "$(<"$state/branch")"
  		printf '\nFinish after verifying copied changes:\n  worktree create --finish\n'
  	fi

  	base="$(${pkgs.coreutils}/bin/basename "$root")"
  	if [[ "$base" =~ \.pr-([0-9]+)$ ]]; then
  		pr_number="''${BASH_REMATCH[1]}"
  		[[ "$printed" == true ]] && printf '\n'
  		printed=true
  		printf '%sPR worktree%s\n\n' "$BLUE" "$RESET"
  		printf 'PR: #%s\n' "$pr_number"
  		if command -v ${pkgs.gh}/bin/gh >/dev/null 2>&1; then
  			${pkgs.gh}/bin/gh pr view "$pr_number" --json number,title,state,headRefName,updatedAt \
  				--jq '"Title: \(.title)\nState: \(.state)\nBranch: \(.headRefName)\nUpdated: \(.updatedAt)"' 2>/dev/null || true
  		fi
  		if [[ -n "$(${pkgs.git}/bin/git status --porcelain)" ]]; then
  			printf 'Local changes: yes\n'
  		else
  			printf 'Local changes: no\n'
  		fi
  	fi

  	if [[ "$printed" == false ]]; then
  		printf 'No pending worktree operation.\n'
  	fi
  }

  fetch_pr_ref() {
  	local number="$1" temp_ref="$2"
  	${pkgs.git}/bin/git fetch --no-prune origin "+refs/pull/$number/head:$temp_ref" \
  		&& ${pkgs.git}/bin/git show-ref --verify --quiet "$temp_ref"
  }

  open_pr_worktree() {
  	require_git_repo
  	command -v ${pkgs.gh}/bin/gh >/dev/null 2>&1 || die "gh CLI not found"
  	local number="$1" info branch target temp_ref dirty response existing_path window
  	window="pr-$number"
  	target="$(repo_sibling_path_for_pr "$number")"
  	temp_ref="refs/worktree-pr/$number"

  	info="$(${pkgs.gh}/bin/gh pr view "$number" --json headRefName --jq '.headRefName')"
  	branch="$info"
  	[[ -n "$branch" && "$branch" != "null" ]] || die "Could not resolve PR branch for #$number"

  	if [[ -d "$target/.git" || -f "$target/.git" ]]; then
  		dirty=false
  		if [[ -n "$(${pkgs.git}/bin/git -C "$target" status --porcelain)" ]]; then
  			dirty=true
  			printf 'PR worktree has local changes.\n' >/dev/tty
  			read -r -p "Force update and discard local changes? [y/N] " response </dev/tty
  			case "$response" in
  			[Yy]*)
  				${pkgs.git}/bin/git -C "$target" reset --hard
  				${pkgs.git}/bin/git -C "$target" clean -fd
  				dirty=false
  				;;
  			*)
  				warn "Skipping update; switching only."
  				;;
  			esac
  		fi
  		if [[ "$dirty" == false ]]; then
  			if fetch_pr_ref "$number" "$temp_ref"; then
  				${pkgs.git}/bin/git -C "$target" reset --hard "$temp_ref"
  			else
  				warn "Could not update PR #$number; switching only."
  			fi
  		fi
  		set_saved_window_for_branch "$branch" "$window"
  		open_path "$target" "$window"
  		return
  	fi

  	if [[ -e "$target" ]]; then
  		die "Path already exists: $target"
  	fi

  	fetch_pr_ref "$number" "$temp_ref" || die "Could not fetch PR #$number"
  	if branch_exists "$branch"; then
  		existing_path="$(branch_checked_out_path "$branch")"
  		if [[ -n "$existing_path" ]]; then
  			warn "PR branch is already checked out at: $existing_path"
  			set_saved_window_for_branch "$branch" "$window"
  			open_path "$existing_path" "$window"
  			return
  		fi
  		${pkgs.git}/bin/git branch -f "$branch" "$temp_ref"
  	else
  		${pkgs.git}/bin/git branch "$branch" "$temp_ref"
  	fi
  	${pkgs.git}/bin/git worktree add "$target" "$branch"
  	set_saved_window_for_branch "$branch" "$window"
  	open_path "$target" "$window"
  }

  select_pr_number() {
  	command -v ${pkgs.gh}/bin/gh >/dev/null 2>&1 || die "gh CLI not found"
  	local selected
  	selected="$(${pkgs.gh}/bin/gh pr list --limit 100 --json number,title,headRefName \
  		--jq '.[] | "#\(.number)\t\(.title)\t\(.headRefName)"' |
  		${fuzzyFinder} --header='Pull requests' --with-nth=1,2,3)"
  	[[ -n "$selected" ]] || exit 0
  	selected="''${selected%%$'\t'*}"
  	printf '%s\n' "''${selected#\#}"
  }

  cmd_switch() {
  	require_git_repo
  	local query="" pr=false pr_number path branch window
  	while [[ $# -gt 0 ]]; do
  		case "$1" in
  		--pr)
  			pr=true
  			if [[ $# -ge 2 && ! "$2" =~ ^- ]]; then
  				pr_number="$2"
  				shift 2
  			else
  				pr_number=""
  				shift
  			fi
  			;;
  		--pr=*)
  			pr=true
  			pr_number="''${1#--pr=}"
  			shift
  			;;
  		-h | --help)
  			show_switch_help
  			exit 0
  			;;
  		*)
  			query="$1"
  			shift
  			;;
  		esac
  	done

  	if [[ "$pr" == true ]]; then
  		[[ -n "''${pr_number:-}" ]] || pr_number="$(select_pr_number)"
  		open_pr_worktree "$pr_number"
  		return
  	fi

  	path="$(select_worktree "$query")"
  	branch="$(${pkgs.git}/bin/git -C "$path" branch --show-current 2>/dev/null || true)"
  	window="$(desired_window_for_worktree "$path" "''${branch:-detached}")"
  	open_path "$path" "$window"
  }

  cmd_list() {
  	require_git_repo
  	while [[ $# -gt 0 ]]; do
  		case "$1" in
  		-h | --help)
  			show_list_help
  			exit 0
  			;;
  		*)
  			die "Unknown list option: $1"
  			;;
  		esac
  	done

  	sorted_worktree_records_tsv | print_worktree_table
  }

  delete_target_record_for_path() {
  	local target="$1" target_key branch window managed path
  	target_key="$(canonical_path "$target")"
  	while IFS=$'\t' read -r branch window managed path; do
  		if [[ "$(canonical_path "$path")" == "$target_key" ]]; then
  			printf '%s\t%s\t%s\t%s\n' "$branch" "$window" "$managed" "$path"
  			return 0
  		fi
  	done < <(list_worktree_records_tsv)
  	return 1
  }

  ensure_deletable_record() {
  	local record="$1" branch _window managed path main_root
  	IFS=$'\t' read -r branch _window managed path <<<"$record"
  	main_root="$(canonical_path "$(managed_repo_root)")"
  	[[ -n "$record" ]] || die "No worktree selected"
  	[[ "$(canonical_path "$path")" != "$main_root" ]] || die "Refusing to delete the main checkout: $path"
  	[[ "$branch" != detached ]] || die "Refusing to delete detached worktree: $path"
  	[[ "$managed" == yes ]] || die "Refusing to delete unmanaged worktree: $path"
  }

  current_delete_record() {
  	local root record
  	root="$(repo_root)"
  	record="$(delete_target_record_for_path "$root" || true)"
  	[[ -n "$record" ]] || die "Current worktree is not listed by git worktree"
  	ensure_deletable_record "$record"
  	printf '%s\n' "$record"
  }

  select_delete_record() {
  	local records selected
  	records="$(managed_worktree_records_tsv)"
  	[[ -n "$records" ]] || die "No managed worktrees to delete"
  	selected="$(printf '%s\n' "$records" | ${fuzzyFinder} --header='Delete worktree' --with-nth=1,2,4)"
  	[[ -n "$selected" ]] || exit 0
  	printf '%s\n' "$selected"
  }

  exact_delete_records_for_name() {
  	local name="$1"
  	managed_worktree_records_tsv | while IFS=$'\t' read -r branch window managed path; do
  		if [[ "$branch" == "$name" || "$(${pkgs.coreutils}/bin/basename "$path")" == "$name" || "$window" == "$name" ]]; then
  			printf '%s\t%s\t%s\t%s\n' "$branch" "$window" "$managed" "$path"
  		fi
  	done
  }

  resolve_delete_record() {
  	local arg="''${1:-}" matches count selected
  	if [[ -z "$arg" ]]; then
  		select_delete_record
  		return
  	fi

  	case "$arg" in
  	--current | .)
  		current_delete_record
  		return
  		;;
  	esac

  	matches="$(exact_delete_records_for_name "$arg")"
  	count="$(printf '%s\n' "$matches" | ${pkgs.gnused}/bin/sed '/^$/d' | ${pkgs.coreutils}/bin/wc -l | ${pkgs.coreutils}/bin/tr -d ' ')"
  	case "$count" in
  	0) die "No managed worktree exactly matches: $arg" ;;
  	1) printf '%s\n' "$matches" ;;
  	*)
  		selected="$(printf '%s\n' "$matches" | ${fuzzyFinder} --header="Delete worktree matching: $arg" --with-nth=1,2,4)"
  		[[ -n "$selected" ]] || exit 0
  		printf '%s\n' "$selected"
  		;;
  	esac
  }

  confirm_delete_record() {
  	local record="$1" keep_branch="$2" branch window _managed path response
  	IFS=$'\t' read -r branch window _managed path <<<"$record"

  	if [[ "$keep_branch" == true ]]; then
  		printf '\nDelete worktree and keep local branch?\n\n' >/dev/tty
  	else
  		printf '\nDelete worktree and local branch?\n\n' >/dev/tty
  	fi
  	if [[ -n "$(${pkgs.git}/bin/git -C "$path" status --porcelain)" ]]; then
  		printf '%sWorktree has local changes. They will be discarded.%s\n\n' "$YELLOW" "$RESET" >/dev/tty
  	fi
  	printf '%sBranch:%s %s\n' "$BLUE" "$RESET" "$branch" >/dev/tty
  	printf '%sPath:%s %s\n' "$BLUE" "$RESET" "$path" >/dev/tty
  	printf '%sWindow:%s %s\n\n' "$BLUE" "$RESET" "$window" >/dev/tty
  	if [[ "$keep_branch" == true ]]; then
  		printf 'Local branch will be kept.\n' >/dev/tty
  	fi
  	printf 'Remote branches and GitHub PRs will not be changed.\n\n' >/dev/tty
  	response=""
  	if ! read -r -p "Delete? [y/N] " response </dev/tty; then
  		die "Cancelled"
  	fi
  	case "$response" in
  	[Yy] | [Yy][Ee][Ss]) return 0 ;;
  	*) die "Cancelled" ;;
  	esac
  }

  remove_pending_state_for_path() {
  	local path="$1" state
  	state="$(state_dir_for_target "$path")"
  	if [[ -f "$state/target_path" ]] && [[ "$(<"$state/target_path")" == "$path" ]]; then
  		${pkgs.coreutils}/bin/rm -rf "$state"
  	fi
  }

  close_tmux_window_for_deleted_path() {
  	local path="$1" destination="$2" id current_id destination_id
  	is_inside_tmux || return 0
  	id="$(tmux_window_for_option_path "$path" || true)"
  	[[ -n "$id" ]] || return 0
  	current_id="$(current_tmux_window_id || true)"
  	if [[ "$id" == "$current_id" ]]; then
  		if destination_id="$(tmux_window_for_option_path "$destination" 2>/dev/null)"; then
  			${pkgs.tmux}/bin/tmux select-window -t "$destination_id" || true
  		else
  			${pkgs.tmux}/bin/tmux select-window -t '!' 2>/dev/null || true
  		fi
  	fi
  	${pkgs.tmux}/bin/tmux kill-window -t "$id" 2>/dev/null || true
  }

  delete_record() {
  	local record="$1" keep_branch="$2" branch window _managed path current_root current_key path_key destination dirty remove_args=()
  	IFS=$'\t' read -r branch window _managed path <<<"$record"
  	current_root="$(repo_root)"
  	current_key="$(canonical_path "$current_root")"
  	path_key="$(canonical_path "$path")"
  	destination="$(managed_repo_root)"
  	[[ -d "$destination" ]] || destination="$HOME"

  	confirm_delete_record "$record" "$keep_branch"

  	if [[ -n "$(${pkgs.git}/bin/git -C "$path" status --porcelain)" ]]; then
  		dirty=true
  		remove_args+=(--force)
  	else
  		dirty=false
  	fi

  	if [[ "$current_key" == "$path_key" ]]; then
  		cd "$destination"
  	fi

  	${pkgs.git}/bin/git worktree remove "''${remove_args[@]}" "$path"
  	if [[ "$keep_branch" == false ]]; then
  		${pkgs.git}/bin/git branch -D "$branch"
  		unset_saved_window_for_branch "$branch"
  	fi
  	remove_pending_state_for_path "$path"

  	if [[ "$current_key" == "$path_key" ]] && ! is_inside_tmux; then
  		write_cd_directive "$destination"
  	fi
  	close_tmux_window_for_deleted_path "$path" "$destination"

  	printf '%sDeleted worktree.%s\n' "$GREEN" "$RESET"
  	printf 'Branch: %s\nPath: %s\nWindow: %s\n' "$branch" "$path" "$window"
  	if [[ "$keep_branch" == true ]]; then
  		printf 'Kept local branch.\n'
  	fi
  	if [[ "$dirty" == true ]]; then
  		printf 'Discarded local changes.\n'
  	fi
  }

  print_prune_table() {
  	${pkgs.gawk}/bin/awk -F '\t' '
        BEGIN {
          rows[0] = "Branch\tWorktree\tDirty\tWindow"
          n = 1
          widths[1] = 6; widths[2] = 8; widths[3] = 5; widths[4] = 6
        }
        {
          rows[n] = $0
          for (i = 1; i <= 4; i++) {
            if (length($i) > widths[i]) widths[i] = length($i)
          }
          n++
        }
        END {
          for (r = 0; r < n; r++) {
            split(rows[r], f, "\t")
            printf "%-*s  %-*s  %-*s  %s\n", widths[1], f[1], widths[2], f[2], widths[3], f[3], f[4]
          }
        }
      '
  }

  print_prune_skipped_table() {
  	${pkgs.gawk}/bin/awk -F '\t' '
        BEGIN {
          rows[0] = "Branch\tReason\tWorktree"
          n = 1
          widths[1] = 6; widths[2] = 6; widths[3] = 8
        }
        {
          rows[n] = $0
          for (i = 1; i <= 3; i++) {
            if (length($i) > widths[i]) widths[i] = length($i)
          }
          n++
        }
        END {
          for (r = 0; r < n; r++) {
            split(rows[r], f, "\t")
            printf "%-*s  %-*s  %s\n", widths[1], f[1], widths[2], f[2], f[3]
          }
        }
      '
  }

  collect_prune_records() {
  	local base="$1" force="$2" targets="$3" skipped="$4"
  	local default_branch current_root current_key main_root main_key branch path path_key dirty window
  	default_branch="$(default_branch_name)"
  	current_root="$(repo_root)"
  	current_key="$(canonical_path "$current_root")"
  	main_root="$(managed_repo_root)"
  	main_key="$(canonical_path "$main_root")"

  	: >"$targets"
  	: >"$skipped"

  	while IFS= read -r branch; do
  		[[ -n "$branch" ]] || continue
  		if [[ "$branch" == "$default_branch" ]]; then
  			continue
  		fi

  		path="$(branch_checked_out_path "$branch")"
  		if [[ -n "$path" ]]; then
  			path_key="$(canonical_path "$path")"
  			if [[ "$path_key" == "$current_key" ]]; then
  				printf '%s\t%s\t%s\n' "$branch" "current worktree" "$path" >>"$skipped"
  				continue
  			fi
  			if [[ "$path_key" == "$main_key" ]]; then
  				printf '%s\t%s\t%s\n' "$branch" "main checkout" "$path" >>"$skipped"
  				continue
  			fi

  			if [[ -n "$(${pkgs.git}/bin/git -C "$path" status --porcelain)" ]]; then
  				dirty=yes
  			else
  				dirty=no
  			fi
  			if [[ "$dirty" == yes && "$force" == false ]]; then
  				printf '%s\t%s\t%s\n' "$branch" "dirty worktree" "$path" >>"$skipped"
  				continue
  			fi
  			window="$(tmux_window_name_for_path "$path" 2>/dev/null || true)"
  			printf '%s\t%s\t%s\t%s\n' "$branch" "$path" "$dirty" "''${window:--}" >>"$targets"
  		else
  			printf '%s\t%s\t%s\t%s\n' "$branch" - no - >>"$targets"
  		fi
  	done < <(list_prune_branches "$base")
  }

  finish_prune_worktree_remove() {
  	local path="$1" mode="$2"
  	if [[ ! -e "$path" && ! -L "$path" ]]; then
  		return 0
  	fi

  	warn "git worktree remove $mode returned success but left the path behind: $path"
  	warn "Removing leftover worktree directory."
  	${pkgs.coreutils}/bin/rm -rf -- "$path"
  	[[ ! -e "$path" && ! -L "$path" ]]
  }

  remove_prune_worktree() {
  	local path="$1" dirty="$2" err force_err double_force_err
  	err="$(${pkgs.coreutils}/bin/mktemp)"
  	force_err="$(${pkgs.coreutils}/bin/mktemp)"
  	double_force_err="$(${pkgs.coreutils}/bin/mktemp)"

  	if [[ "$dirty" == yes ]]; then
  		if ${pkgs.git}/bin/git worktree remove --force "$path" 2>"$force_err"; then
  			if finish_prune_worktree_remove "$path" "--force"; then
  				${pkgs.coreutils}/bin/rm -f "$err" "$force_err" "$double_force_err"
  				return 0
  			fi
  		fi
  	else
  		if ${pkgs.git}/bin/git worktree remove "$path" 2>"$err"; then
  			if finish_prune_worktree_remove "$path" "without force"; then
  				${pkgs.coreutils}/bin/rm -f "$err" "$force_err" "$double_force_err"
  				return 0
  			fi
  		fi
  		warn "Could not remove clean-looking worktree without force: $path"
  		warn "Retrying with --force."
  		if ${pkgs.git}/bin/git worktree remove --force "$path" 2>"$force_err"; then
  			if finish_prune_worktree_remove "$path" "--force"; then
  				${pkgs.coreutils}/bin/rm -f "$err" "$force_err" "$double_force_err"
  				return 0
  			fi
  		fi
  	fi

  	warn "Retrying with --force --force for nested repositories: $path"
  	if ${pkgs.git}/bin/git worktree remove --force --force "$path" 2>"$double_force_err"; then
  		if finish_prune_worktree_remove "$path" "--force --force"; then
  			${pkgs.coreutils}/bin/rm -f "$err" "$force_err" "$double_force_err"
  			return 0
  		fi
  	fi

  	printf 'git worktree remove failed for: %s\n' "$path" >&2
  	if [[ -s "$err" ]]; then
  		printf '\nwithout force:\n' >&2
  		${pkgs.coreutils}/bin/cat "$err" >&2
  	fi
  	if [[ -s "$force_err" ]]; then
  		printf '\nwith --force:\n' >&2
  		${pkgs.coreutils}/bin/cat "$force_err" >&2
  	fi
  	if [[ -s "$double_force_err" ]]; then
  		printf '\nwith --force --force:\n' >&2
  		${pkgs.coreutils}/bin/cat "$double_force_err" >&2
  	fi
  	${pkgs.coreutils}/bin/rm -f "$err" "$force_err" "$double_force_err"
  	return 1
  }

  prune_records() {
  	local targets="$1" branch path dirty window cleaned
  	while IFS=$'\t' read -r branch path dirty window; do
  		[[ -n "$branch" ]] || continue
  		cleaned="branch"
  		if [[ "$path" != - ]]; then
  			remove_prune_worktree "$path" "$dirty" || die "Could not remove worktree for $branch: $path"
  			remove_pending_state_for_path "$path"
  			close_tmux_window_for_deleted_path "$path" "$(managed_repo_root)"
  			cleaned="''${cleaned}, worktree: $path"
  		fi
  		${pkgs.git}/bin/git branch -D "$branch" >/dev/null || die "Could not delete branch: $branch"
  		unset_saved_window_for_branch "$branch"
  		if [[ "$window" != - ]]; then
  			cleaned="''${cleaned}, window: $window"
  		fi
  		printf '%sPruned:%s %s (%s)\n' "$GREEN" "$RESET" "$branch" "$cleaned"
  	done <"$targets"
  }

  cmd_prune() {
  	require_git_repo
  	local force=false base tmpdir targets skipped target_count skipped_count
  	while [[ $# -gt 0 ]]; do
  		case "$1" in
  		-h | --help)
  			show_prune_help
  			exit 0
  			;;
  		-f | --force)
  			force=true
  			shift
  			;;
  		*)
  			die "Unknown prune option: $1"
  			;;
  		esac
  	done

  	base="$(default_base_ref)"
  	${pkgs.git}/bin/git rev-parse --verify --quiet "$base^{commit}" >/dev/null || die "Could not resolve prune base: $base"
  	tmpdir="$(${pkgs.coreutils}/bin/mktemp -d)"
  	targets="$tmpdir/targets"
  	skipped="$tmpdir/skipped"

  	collect_prune_records "$base" "$force" "$targets" "$skipped"
  	target_count="$(${pkgs.gnused}/bin/sed '/^$/d' "$targets" | ${pkgs.coreutils}/bin/wc -l | ${pkgs.coreutils}/bin/tr -d ' ')"
  	skipped_count="$(${pkgs.gnused}/bin/sed '/^$/d' "$skipped" | ${pkgs.coreutils}/bin/wc -l | ${pkgs.coreutils}/bin/tr -d ' ')"

  	printf 'Base: %s\n' "$base"
  	if [[ "$target_count" -gt 0 ]]; then
  		printf '\nPrune targets:\n'
  		print_prune_table <"$targets"
  	fi
  	if [[ "$skipped_count" -gt 0 ]]; then
  		printf '\nSkipped:\n'
  		print_prune_skipped_table <"$skipped"
  	fi
  	cleanup_stale_saved_windows
  	if [[ "$target_count" -eq 0 ]]; then
  		printf '\nNothing to prune.\n'
  		${pkgs.coreutils}/bin/rm -rf "$tmpdir"
  		return 0
  	fi
  	prune_records "$targets"
  	${pkgs.coreutils}/bin/rm -rf "$tmpdir"
  }

  cmd_delete() {
  	require_git_repo
  	local arg="" record keep_branch=false
  	while [[ $# -gt 0 ]]; do
  		case "$1" in
  		-h | --help)
  			show_delete_help
  			exit 0
  			;;
  		--keep-branch)
  			keep_branch=true
  			shift
  			;;
  		--current)
  			[[ -z "$arg" ]] || die "delete accepts only one target"
  			arg="$1"
  			shift
  			;;
  		*)
  			[[ -z "$arg" ]] || die "delete accepts only one target"
  			arg="$1"
  			shift
  			;;
  		esac
  	done

  	record="$(resolve_delete_record "$arg")"
  	ensure_deletable_record "$record"
  	delete_record "$record" "$keep_branch"
  }

  update_pending_state_after_rename() {
  	local old_path="$1" new_path="$2" new_branch="$3" new_window="$4" old_state new_state
  	old_state="$(state_dir_for_target "$old_path")"
  	if [[ -f "$old_state/target_path" ]] && [[ "$(<"$old_state/target_path")" == "$old_path" ]]; then
  		new_state="$(state_dir_for_target "$new_path")"
  		${pkgs.coreutils}/bin/mkdir -p "$(${pkgs.coreutils}/bin/dirname "$new_state")"
  		${pkgs.coreutils}/bin/mv "$old_state" "$new_state"
  		printf '%s\n' "$new_path" >"$new_state/target_path"
  		printf '%s\n' "$new_branch" >"$new_state/branch"
  		printf '%s\n' "$new_window" >"$new_state/window"
  	fi
  }

  cmd_rename() {
  	require_git_repo
  	if [[ $# -gt 0 && ( "$1" == "-h" || "$1" == "--help" ) ]]; then
  		show_rename_help
  		exit 0
  	fi

  	local new_branch="''${1:-}" old_branch root new_path generated new_window
  	if [[ $# -gt 1 ]]; then
  		die "rename accepts at most one branch name"
  	fi

  	root="$(repo_root)"
  	if is_main_checkout_path "$root"; then
  		die "Refusing to rename the main checkout: $root"
  	fi
  	old_branch="$(current_branch)"
  	[[ -n "$old_branch" ]] || die "Cannot rename a detached HEAD worktree"

  	if [[ -z "$new_branch" ]]; then
  		has_any_diff_for_names || die "No changes available for name generation"
  		generated="$(generate_names_from_input current)"
  		new_branch="''${generated%%$'\t'*}"
  		new_window="''${generated#*$'\t'}"
  		generated="$(confirm_generated_names current Rename "$new_branch" "$new_window")"
  		new_branch="''${generated%%$'\t'*}"
  		new_window="''${generated#*$'\t'}"
  	else
  		new_window="$(short_window_from_branch "$new_branch")"
  	fi

  	${pkgs.git}/bin/git check-ref-format --branch "$new_branch" >/dev/null || die "Invalid branch name: $new_branch"
  	if branch_exists "$new_branch"; then
  		die "Branch already exists: $new_branch"
  	fi
  	new_path="$(repo_sibling_path_for_branch "$new_branch")"
  	if [[ -e "$new_path" ]]; then
  		die "Path already exists: $new_path"
  	fi

  	${pkgs.git}/bin/git branch -m "$old_branch" "$new_branch"
  	set_saved_window_for_branch "$new_branch" "$new_window"
  	${pkgs.git}/bin/git worktree move "$root" "$new_path"
  	update_pending_state_after_rename "$root" "$new_path" "$new_branch" "$new_window"

  	if is_inside_tmux; then
  		${pkgs.tmux}/bin/tmux rename-window "$new_window"
  		${pkgs.tmux}/bin/tmux set-window-option automatic-rename off >/dev/null || true
  		${pkgs.tmux}/bin/tmux set-window-option allow-rename off >/dev/null || true
  		${pkgs.tmux}/bin/tmux set-window-option @worktree_path "$new_path" >/dev/null || true
  	fi
  	write_cd_directive "$new_path"
  	printf '%sRenamed worktree.%s\n' "$GREEN" "$RESET"
  	printf 'Branch: %s\nPath: %s\nWindow: %s\n' "$new_branch" "$new_path" "$new_window"
  }

  main() {
  	if [[ $# -eq 0 ]]; then
  		show_help
  		exit 0
  	fi

  	case "$1" in
  	-h | --help)
  		show_help
  		;;
  	-v | --version)
  		printf 'worktree %s\n' "$VERSION"
  		;;
  	create)
  		shift
  		cmd_create "$@"
  		;;
  	list)
  		shift
  		cmd_list "$@"
  		;;
  	status)
  		shift
  		cmd_status "$@"
  		;;
  	switch)
  		shift
  		cmd_switch "$@"
  		;;
  	rename)
  		shift
  		cmd_rename "$@"
  		;;
  	prune)
  		shift
  		cmd_prune "$@"
  		;;
  	delete)
  		shift
  		cmd_delete "$@"
  		;;
  	*)
  		die "Unknown command: $1"
  		;;
  	esac
  }

  main "$@"

''
