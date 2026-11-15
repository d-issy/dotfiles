//! Help texts, printed verbatim.

pub const MAIN: &str = r#"worktree - personal git worktree helper

Usage:
  worktree create [--base <ref>]
  worktree create --finish
  worktree list
  worktree status
  worktree switch [<query>]
  worktree switch --pr [<number>]
  worktree rename [<new-branch>]
  worktree prune [-f|--force] [-y|--yes]
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
"#;

pub const CREATE: &str = r#"Usage:
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
"#;

pub const LIST: &str = r#"Usage:
  worktree list

Lists git worktrees in a table.

Columns:
  Branch   Local branch name.
  Window   Existing tmux window name associated by @worktree_path, or -.
  Managed  yes if this command can delete it; no for the main checkout or
           detached/branchless worktrees.
  Path     Worktree directory.

The default branch worktree is shown first. Others are sorted by branch name.
"#;

pub const STATUS: &str = r#"Usage:
  worktree status

Shows pending `worktree create` state and basic PR worktree information for
the current worktree.
"#;

pub const SWITCH: &str = r#"Usage:
  worktree switch [<query>]
  worktree switch --pr [<number>]

Switches to a worktree. Inside tmux, selects or opens a tmux window. Outside
tmux, asks the shell wrapper to cd to the target path.

Options:
  --pr [number]  Open or switch to a GitHub PR worktree. If number is omitted,
                 choose a PR with the fuzzy finder.
  -h, --help     Show this help.
"#;

pub const RENAME: &str = r#"Usage:
  worktree rename
  worktree rename <new-branch>

Renames the current local branch, worktree directory, and tmux window.

Without <new-branch>, uses Pi to generate branch/window names from current
changes and asks for confirmation.
"#;

pub const PRUNE: &str = r#"Usage:
  worktree prune
  worktree prune -f
  worktree prune --force
  worktree prune -y
  worktree prune --yes

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
  - Checks branches and removes worktrees in parallel (up to 4 at a time).
  - Skips branches that were never committed to since creation.
  - Shows targets and asks for confirmation ([y/N], read from /dev/tty)
    before pruning.

Options:
  -f, --force  Also delete dirty merged worktrees.
  -y, --yes    Skip the confirmation prompt (for scripts).
  -h, --help   Show this help.
"#;

pub const DELETE: &str = r#"Usage:
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
"#;
