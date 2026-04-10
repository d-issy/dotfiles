# Check Git Branch Diff

Identify the base branch and gather the diff for the current branch.

## When to Use

- Another runbook references this runbook
- User asks to check what changed on the current branch

## When NOT to Use

- The diff target is not a branch (e.g. comparing two arbitrary commits)

## Tips

- **Start with file list, not full diff.** Large diffs waste context. Always check `--name-only` first and read full diffs selectively.
- **`gh` is not required.** Base branch detection works with `git` alone.

## Workflow

### 1. Identify the Base Branch

Try in order:

```bash
git rev-parse --abbrev-ref origin/HEAD
```

Output is `origin/<branch>` — use the branch name part. If `origin/HEAD` is not set, check for common defaults (`main`, `master`, `develop`). If ambiguous, ask the user.

### 2. Get the File List

```bash
git diff --name-only --cached <base>
```

Review the file list to understand the scope of changes.

### 3. Read Diffs Selectively

For each relevant file or group of files:

```bash
git diff --cached <base> -- <path>
```

Skip files that are not relevant to the task (e.g. lock files, auto-generated files).
