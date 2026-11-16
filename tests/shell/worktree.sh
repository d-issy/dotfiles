#!/usr/bin/env bash
set -euo pipefail

test_root=$(realpath "$(mktemp -d)")
trap 'cd /; rm -rf "$test_root"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=Audit GIT_COMMITTER_NAME=Audit
export GIT_AUTHOR_EMAIL=audit@example.test GIT_COMMITTER_EMAIL=audit@example.test
unset TMUX WORKTREE_CALLER_PWD WORKTREE_TTY

# Outside tmux the command reports the path to switch to through this file.
export WORKTREE_CD_FILE="$test_root/cd"
wt() { "$WORKTREE_BIN" "$@"; }
opened_path() { cat "$WORKTREE_CD_FILE"; }

assert_equal() {
	if [[ "$1" != "$2" ]]; then
		printf 'Expected %s, got %s: %s\n' "$1" "$2" "$3" >&2
		exit 1
	fi
}

new_repo() {
	local path="$test_root/$1"
	mkdir -p "$path"
	cd "$path"
	git init -q -b main
	printf 'one\ntwo\nthree\nfour\nfive\n' >file
	git add file
	git commit -qm initial
}

new_repo pr
repo=$PWD
base=$(git rev-parse HEAD)
git remote add origin "$repo"
git branch feature
git switch -q feature
printf 'local feature\n' >>file
git commit -qam 'unpublished feature'
feature_head=$(git rev-parse HEAD)
git switch -q main
git update-ref refs/pull/1/head "$base"
export TEST_PR_BRANCH=feature
wt switch --pr 1
target="${repo}.pr-1"
assert_equal "$feature_head" "$(git rev-parse feature)" 'preserve colliding branch'
assert_equal worktree/pr-1 "$(git -C "$target" branch --show-current)" 'isolate PR branch name collision'
assert_equal "$target" "$(opened_path)" 'open the PR worktree'
assert_equal pr-1 "$(git config branch.worktree/pr-1.worktree-window)" 'remember the PR window name'

printf 'unpublished PR commit\n' >>"$target/file"
git -C "$target" commit -qam 'unpublished PR work'
local_head=$(git -C "$target" rev-parse HEAD)
printf 'uncommitted PR work\n' >>"$target/file"
wt switch --pr 1
assert_equal "$local_head" "$(git -C "$target" rev-parse HEAD)" 'preserve local PR commits'
assert_equal 'uncommitted PR work' "$(tail -n 1 "$target/file")" 'preserve dirty divergent PR worktree'

export TEST_PR_BRANCH=remote-feature
git update-ref refs/pull/2/head "$base"
wt switch --pr=2
target2="${repo}.pr-2"
printf 'remote update\n' >>file
git commit -qam 'remote update'
updated_head=$(git rev-parse HEAD)
git update-ref refs/pull/2/head "$updated_head"
wt switch --pr 2
assert_equal "$updated_head" "$(git -C "$target2" rev-parse HEAD)" 'fast-forward a clean PR worktree'

# A previously kept namespaced branch must also retain unpublished commits.
git branch collision "$feature_head"
git branch worktree/pr-3 "$feature_head"
git update-ref refs/pull/3/head "$base"
export TEST_PR_BRANCH=collision
if wt switch --pr 3 2>/dev/null; then
	echo 'A divergent existing PR branch should refuse replacement' >&2
	exit 1
fi
assert_equal "$feature_head" "$(git rev-parse worktree/pr-3)" 'preserve a divergent kept PR branch'
[[ ! -e "${repo}.pr-3" ]]

if wt switch --pr abc 2>/dev/null; then
	echo 'A non-numeric PR number must be rejected' >&2
	exit 1
fi

# Switching by query reports the matching worktree path.
: >"$WORKTREE_CD_FILE"
wt switch pr-2
assert_equal "$target2" "$(opened_path)" 'switch to a worktree by path query'

new_repo prune
repo=$PWD
locked="$test_root/locked"
git worktree add -qb locked "$locked"
git -C "$locked" commit -q --allow-empty -m 'locked work'
git merge -q --ff-only locked
git worktree lock --reason 'Keep this checkout' "$locked"
prune_output=$(wt prune --force --yes)
[[ "$prune_output" == *'locked worktree'* ]]
[[ "$prune_output" == *'Nothing to prune.'* ]]
[[ -e "$locked/file" ]]
git show-ref --verify --quiet refs/heads/locked

dirty="$test_root/dirty"
git worktree add -qb dirty "$dirty"
printf 'uncommitted change\n' >>"$dirty/file"
clean="$test_root/clean"
git worktree add -qb clean "$clean"
prune_output=$(wt prune --yes 2>/dev/null)
[[ "$prune_output" == *'dirty worktree'* ]]
[[ "$prune_output" == *'Pruned:'*' clean (branch, worktree: '"$clean"')'* ]]
[[ -e "$dirty/file" && ! -e "$clean" ]]
wt prune --force --yes >/dev/null 2>&1
[[ ! -e "$dirty" && -e "$locked/file" ]]
if git show-ref --verify --quiet refs/heads/dirty; then
	echo 'prune --force should delete the dirty merged branch' >&2
	exit 1
fi

# A branch created by worktree create is protected even after reflog expiry.
fresh="$test_root/fresh"
git worktree add -qb fresh "$fresh"
git config branch.fresh.worktreeBase "$(git rev-parse fresh)"
git commit -q --allow-empty -m 'main moves on'
git reflog expire --expire=now refs/heads/fresh
export WORKTREE_TTY="$test_root/answer"
printf 'n\n' >"$WORKTREE_TTY"
prune_output=$(wt prune 2>/dev/null || true)
[[ "$prune_output" != *'fresh'* ]]
git -C "$fresh" commit -q --allow-empty -m 'fresh work'
git merge -q --no-edit fresh
prune_output=$(wt prune 2>/dev/null || true)
[[ "$prune_output" == *$'\nfresh '* ]]

# A merged PR branch fetched with --pr has no upstream and one reflog entry.
# Unlike a fresh create branch, it must still be eligible for pruning.
git remote add origin "$repo"
git update-ref refs/pull/4/head HEAD
export TEST_PR_BRANCH=merged-pr
wt switch --pr 4
assert_equal '' "$(git config --get branch.merged-pr.worktreeBase || true)" 'PR branches have no creation-base protection'
assert_equal '' "$(git for-each-ref --format='%(upstream)' refs/heads/merged-pr)" 'PR branch has no upstream'
prune_output=$(wt prune 2>/dev/null || true)
[[ "$prune_output" == *$'\nmerged-pr '* ]]
unset WORKTREE_TTY

# prune requires confirmation unless --yes is given.
new_repo prune-confirm
git worktree add -qb merged "$test_root/prune-confirm.merged"
git -C "$test_root/prune-confirm.merged" commit -q --allow-empty -m 'merged work'
git merge -q --ff-only merged
export WORKTREE_TTY="$test_root/answer"
printf 'n\n' >"$WORKTREE_TTY"
if wt prune >/dev/null 2>&1; then
	echo 'Declined prune must not succeed' >&2
	exit 1
fi
git show-ref --verify --quiet refs/heads/merged
[[ -d "$test_root/prune-confirm.merged" ]]
: >"$WORKTREE_TTY"
if wt prune >/dev/null 2>&1; then
	echo 'Prune without an answer must not succeed' >&2
	exit 1
fi
git show-ref --verify --quiet refs/heads/merged
printf 'y\n' >"$WORKTREE_TTY"
wt prune >/dev/null 2>&1
if git show-ref --verify --quiet refs/heads/merged; then
	echo 'Confirmed prune should delete the branch' >&2
	exit 1
fi
git worktree add -qb merged2 "$test_root/prune-confirm.merged2"
git -C "$test_root/prune-confirm.merged2" commit -q --allow-empty -m 'merged work'
git merge -q --ff-only merged2
: >"$WORKTREE_TTY"
wt prune --yes >/dev/null 2>&1
if git show-ref --verify --quiet refs/heads/merged2; then
	echo 'prune --yes should delete without prompting' >&2
	exit 1
fi
unset WORKTREE_TTY

# A local-only worktree defaults its base to HEAD; the delete warning's
# unique-commit listing is covered by the crate's cargo tests.
new_repo delete-warning
repo=$PWD
git worktree add -qb delete-me "$test_root/delete-warning.target"
cd "$test_root/delete-warning.target"
git commit -q --allow-empty -m 'unique work at risk'
prune_output=$(wt prune --yes)
assert_equal 'Base: HEAD' "${prune_output%%$'\n'*}" 'local-only base defaults to HEAD'
git show-ref --verify --quiet refs/heads/delete-me
cd "$repo"

# rename moves the worktree first and restores it if the branch rename fails.
new_repo rename
repo=$PWD
git worktree add -qb old-name "$test_root/rename-old"
cd "$test_root/rename-old"
git branch taken
if wt rename taken >/dev/null 2>&1; then
	echo 'Renaming onto an existing branch must fail' >&2
	exit 1
fi
[[ -d "$test_root/rename-old" ]]
assert_equal old-name "$(git -C "$test_root/rename-old" branch --show-current)" 'failed rename keeps the branch'
wt rename new-name >/dev/null 2>&1
new_dir="$test_root/rename.new-name"
[[ -d "$new_dir" && ! -e "$test_root/rename-old" ]]
assert_equal new-name "$(git -C "$new_dir" branch --show-current)" 'rename updates branch and directory'
assert_equal "$new_dir" "$(opened_path)" 'rename reports the new path'
cd "$repo"

# create --finish removes the copied staged hunk from the source worktree.
write_pending_state() {
	local state
	state="$(git rev-parse --path-format=absolute --git-common-dir)/worktree/create/$(git hash-object --stdin <<<"$repo")"
	mkdir -p "$state"
	cp "$1" "$state/cleanup_patch"
	cp "$1" "$state/patch"
	printf '%s\n' "$repo" >"$state/source_path"
	printf '%s\n' "$repo" >"$state/target_path"
	printf '%s\n' cleanup >"$state/branch"
	printf '%s\n' "$state"
}

new_repo cleanup
repo=$PWD
sed -i 's/^three$/THREE/' file
git add file
sed -i 's/^five$/FIVE/' file
patch="$test_root/cleanup.patch"
git diff --cached --binary -U0 >"$patch"
state=$(write_pending_state "$patch")
[[ "$(wt status)" == *'Create pending'* ]]
wt create --finish >/dev/null
git diff --cached --quiet
assert_equal "$(printf 'one\ntwo\nthree\nfour\nFIVE')" "$(cat file)" 'remove staged hunk and retain an unstaged hunk'
[[ ! -e "$state" ]]

git restore file
sed -i 's/^three$/THREE/' file
git add file
git diff --cached --binary -U0 >"$patch"
sed -i 's/^THREE$/overlapping-unstaged-change/' file
index_before=$(git write-tree)
worktree_before=$(cat file)
state=$(write_pending_state "$patch")
if wt create --finish >/dev/null 2>&1; then
	echo 'Overlapping unstaged edits must prevent source cleanup' >&2
	exit 1
fi
assert_equal "$index_before" "$(git write-tree)" 'preserve index after failed cleanup'
assert_equal "$worktree_before" "$(cat file)" 'preserve working file after failed cleanup'
[[ -d "$state" ]]

# Naming from a subdirectory still includes changes elsewhere in the repo,
# while both root and nested secrets and dependency noise stay excluded.
# The fake Pi records its prompt and fails, so create stops before prompting.
mkdir -p "$test_root/bin"
printf '#!%s\ncat >"$PI_PROMPT"\nexit 1\n' "$(command -v bash)" >"$test_root/bin/pi"
chmod +x "$test_root/bin/pi"
export PI_PROMPT="$test_root/pi-prompt"
new_repo naming
mkdir -p sub nested
printf 'visible root change\n' >root-change
printf 'visible nested change\n' >sub/change
for path in .env.local root.pem root.key root.lock package-lock.json pnpm-lock.yaml go.sum flake.lock nested/.env.local nested/secret.pem nested/secret.key nested/deps.lock nested/package-lock.json nested/pnpm-lock.yaml nested/go.sum nested/flake.lock; do
	printf 'excluded payload\n' >"$path"
done
git add .
cd sub
if PATH="$test_root/bin:$PATH" wt create >/dev/null 2>&1; then
	echo 'create must stop when Pi fails' >&2
	exit 1
fi
naming_output=$(cat "$PI_PROMPT")
[[ "$naming_output" == 'Generate names for a git worktree task from the staged changes.'* ]]
[[ "$naming_output" == *'visible root change'* && "$naming_output" == *'visible nested change'* ]]
[[ "$naming_output" != *'excluded payload'* ]]
if git diff --cached --quiet; then
	echo 'A failed create must keep the staged changes' >&2
	exit 1
fi

# WORKTREE_CALLER_PWD selects the repository to act on.
cd /
prune_output=$(WORKTREE_CALLER_PWD="$test_root/naming" wt prune --yes)
assert_equal 'Base: HEAD' "${prune_output%%$'\n'*}" 'run from the caller directory'

echo 'worktree regressions passed'
