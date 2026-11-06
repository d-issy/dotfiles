#!/usr/bin/env bash
set -euo pipefail

test_root=$(realpath "$(mktemp -d)")
trap 'cd /; rm -rf "$test_root"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=Audit GIT_COMMITTER_NAME=Audit
export GIT_AUTHOR_EMAIL=audit@example.test GIT_COMMITTER_EMAIL=audit@example.test
unset TMUX WORKTREE_CALLER_PWD WORKTREE_CD_FILE

# Exercise the generated implementation without its interactive command dispatch.
# shellcheck disable=SC1090
source <(sed '/^[[:space:]]*main "\$@"[[:space:]]*$/d' "$WORKTREE_SCRIPT")
open_path() { opened_path="$1"; }

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
open_pr_worktree 1
target="${repo}.pr-1"
assert_equal "$feature_head" "$(git rev-parse feature)" 'preserve colliding branch'
assert_equal worktree/pr-1 "$(git -C "$target" branch --show-current)" 'isolate PR branch name collision'
assert_equal "$target" "$opened_path" 'open the PR worktree'

printf 'unpublished PR commit\n' >>"$target/file"
git -C "$target" commit -qam 'unpublished PR work'
local_head=$(git -C "$target" rev-parse HEAD)
printf 'uncommitted PR work\n' >>"$target/file"
open_pr_worktree 1
assert_equal "$local_head" "$(git -C "$target" rev-parse HEAD)" 'preserve local PR commits'
assert_equal 'uncommitted PR work' "$(tail -n 1 "$target/file")" 'preserve dirty divergent PR worktree'

export TEST_PR_BRANCH=remote-feature
git update-ref refs/pull/2/head "$base"
open_pr_worktree 2
target2="${repo}.pr-2"
printf 'remote update\n' >>file
git commit -qam 'remote update'
updated_head=$(git rev-parse HEAD)
git update-ref refs/pull/2/head "$updated_head"
open_pr_worktree 2
assert_equal "$updated_head" "$(git -C "$target2" rev-parse HEAD)" 'fast-forward a clean PR worktree'

# A previously kept namespaced branch must also retain unpublished commits.
git branch collision "$feature_head"
git branch worktree/pr-3 "$feature_head"
git update-ref refs/pull/3/head "$base"
export TEST_PR_BRANCH=collision
if (open_pr_worktree 3); then
	echo 'A divergent existing PR branch should refuse replacement' >&2
	exit 1
fi
assert_equal "$feature_head" "$(git rev-parse worktree/pr-3)" 'preserve a divergent kept PR branch'
[[ ! -e "${repo}.pr-3" ]]

new_repo prune
repo=$PWD
locked="$test_root/locked"
git worktree add -qb locked "$locked"
git worktree lock --reason 'Keep this checkout' "$locked"
targets="$test_root/targets"
skipped="$test_root/skipped"
collect_prune_records HEAD true "$targets" "$skipped"
[[ ! -s "$targets" ]]
[[ $(cat "$skipped") == *'locked worktree'* ]]
for force in false true; do
	if remove_prune_worktree "$locked" "$force"; then
		echo 'Pruning must preserve locked worktrees, even with --force' >&2
		exit 1
	fi
	[[ -e "$locked/file" ]]
done

dirty="$test_root/dirty"
git worktree add -qb dirty "$dirty"
printf 'uncommitted change\n' >>"$dirty/file"
if remove_prune_worktree "$dirty" false; then
	echo 'Pruning without --force must preserve dirty worktrees' >&2
	exit 1
fi
[[ -e "$dirty/file" ]]
remove_prune_worktree "$dirty" true
[[ ! -e "$dirty" ]]

clean="$test_root/clean"
git worktree add -qb clean "$clean"
remove_prune_worktree "$clean" false
[[ ! -e "$clean" ]]

new_repo cleanup
repo=$PWD
sed -i 's/^three$/THREE/' file
git add file
sed -i 's/^five$/FIVE/' file
patch="$test_root/cleanup.patch"
git diff --cached --binary -U0 >"$patch"
remove_original_patch_from_source "$repo" "$patch"
git diff --cached --quiet
assert_equal "$(printf 'one\ntwo\nthree\nfour\nFIVE')" "$(cat file)" 'remove staged hunk and retain an unstaged hunk'

git restore file
sed -i 's/^three$/THREE/' file
git add file
git diff --cached --binary -U0 >"$patch"
sed -i 's/^THREE$/overlapping-unstaged-change/' file
index_before=$(git write-tree)
worktree_before=$(cat file)
if remove_original_patch_from_source "$repo" "$patch"; then
	echo 'Overlapping unstaged edits must prevent source cleanup' >&2
	exit 1
fi
assert_equal "$index_before" "$(git write-tree)" 'preserve index after failed cleanup'
assert_equal "$worktree_before" "$(cat file)" 'preserve working file after failed cleanup'

echo 'worktree regressions passed'
