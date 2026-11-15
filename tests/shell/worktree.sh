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
git -C "$locked" commit -q --allow-empty -m 'locked work'
git merge -q --ff-only locked
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

# A branch created by worktree create is protected even after reflog expiry.
fresh="$test_root/fresh"
create_worktree HEAD fresh fresh "$fresh"
assert_equal "$(git rev-parse fresh)" "$(git config branch.fresh.worktreeBase)" 'record the creation commit'
git commit -q --allow-empty -m 'main moves on'
assert_equal '' "$(list_prune_branches HEAD | grep -x fresh || true)" 'prune skips a never-committed branch'
git reflog expire --expire=now refs/heads/fresh
assert_equal '' "$(list_prune_branches HEAD | grep -x fresh || true)" 'fresh branch protection survives reflog expiry'
git -C "$fresh" commit -q --allow-empty -m 'fresh work'
git merge -q --no-edit fresh
assert_equal fresh "$(list_prune_branches HEAD | grep -x fresh || true)" 'prune keeps merged branches with commits prunable'

# A merged PR branch fetched with --pr has no upstream and one reflog entry.
# Unlike a fresh create branch, it must still be eligible for pruning.
git remote add origin "$repo"
git update-ref refs/pull/4/head HEAD
export TEST_PR_BRANCH=merged-pr
open_pr_worktree 4
assert_equal '' "$(git config --get branch.merged-pr.worktreeBase || true)" 'PR branches have no creation-base protection'
assert_equal '' "$(git for-each-ref --format='%(upstream)' refs/heads/merged-pr)" 'PR branch has no upstream'
assert_equal merged-pr "$(list_prune_branches HEAD | grep -x merged-pr || true)" 'prune includes a merged PR branch'

# prune requires confirmation unless --yes is given.
new_repo prune-confirm
git worktree add -qb merged "$test_root/prune-confirm.merged"
git -C "$test_root/prune-confirm.merged" commit -q --allow-empty -m 'merged work'
git merge -q --ff-only merged
export WORKTREE_TTY="$test_root/answer"
printf 'n\n' >"$WORKTREE_TTY"
if (cmd_prune) >/dev/null 2>&1; then
	echo 'Declined prune must not succeed' >&2
	exit 1
fi
git show-ref --verify --quiet refs/heads/merged
[[ -d "$test_root/prune-confirm.merged" ]]
: >"$WORKTREE_TTY"
if (cmd_prune) >/dev/null 2>&1; then
	echo 'Prune without an answer must not succeed' >&2
	exit 1
fi
git show-ref --verify --quiet refs/heads/merged
printf 'y\n' >"$WORKTREE_TTY"
(cmd_prune) >/dev/null 2>&1
if git show-ref --verify --quiet refs/heads/merged; then
	echo 'Confirmed prune should delete the branch' >&2
	exit 1
fi
git worktree add -qb merged2 "$test_root/prune-confirm.merged2"
git -C "$test_root/prune-confirm.merged2" commit -q --allow-empty -m 'merged work'
git merge -q --ff-only merged2
: >"$WORKTREE_TTY"
(cmd_prune --yes) >/dev/null 2>&1
if git show-ref --verify --quiet refs/heads/merged2; then
	echo 'prune --yes should delete without prompting' >&2
	exit 1
fi
unset WORKTREE_TTY

# The delete warning must find unique commits from inside the target branch,
# including when the default comparison base would otherwise be HEAD itself.
new_repo delete-warning
repo=$PWD
git worktree add -qb delete-me "$test_root/delete-warning.target"
cd "$test_root/delete-warning.target"
git commit -q --allow-empty -m 'unique work at risk'
assert_equal HEAD "$(default_base_ref)" 'local-only delete would default to HEAD'
assert_equal "$(git log -1 --oneline)" "$(branch_unique_commits delete-me)" 'current branch unique commits are visible before deletion'
git branch saved-copy
assert_equal '' "$(branch_unique_commits delete-me)" 'commits reachable from another branch are safe'
git branch -D saved-copy
git update-ref refs/remotes/origin/saved-copy HEAD
assert_equal '' "$(branch_unique_commits delete-me)" 'commits reachable from a remote branch are safe'
cd "$repo"

# rename moves the worktree first and restores it if the branch rename fails.
new_repo rename
repo=$PWD
git worktree add -qb old-name "$test_root/rename-old"
cd "$test_root/rename-old"
git branch taken
if (cmd_rename taken) >/dev/null 2>&1; then
	echo 'Renaming onto an existing branch must fail' >&2
	exit 1
fi
[[ -d "$test_root/rename-old" ]]
assert_equal old-name "$(git -C "$test_root/rename-old" branch --show-current)" 'failed rename keeps the branch'
(cmd_rename new-name) >/dev/null 2>&1
new_dir="$(repo_sibling_path_for_branch new-name)"
[[ -d "$new_dir" && ! -e "$test_root/rename-old" ]]
assert_equal new-name "$(git -C "$new_dir" branch --show-current)" 'rename updates branch and directory'
cd "$repo"

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

# Naming from a subdirectory still includes changes elsewhere in the repo,
# while both root and nested secrets and dependency noise stay excluded.
new_repo naming
mkdir -p sub nested
printf 'visible root change\n' >root-change
printf 'visible nested change\n' >sub/change
for path in .env.local root.pem root.key root.lock package-lock.json pnpm-lock.yaml go.sum flake.lock nested/.env.local nested/secret.pem nested/secret.key nested/deps.lock nested/package-lock.json nested/pnpm-lock.yaml nested/go.sum nested/flake.lock; do
	printf 'excluded payload\n' >"$path"
done
git add .
cd sub
naming_output=$(naming_diff --cached)
[[ "$naming_output" == *'visible root change'* && "$naming_output" == *'visible nested change'* ]]
[[ "$naming_output" != *'excluded payload'* ]]

echo 'worktree regressions passed'
