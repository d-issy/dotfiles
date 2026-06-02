# Check Git Unstaged Diff

Identify unstaged changes in the working tree before committing.

## When to Use

- User asks to check or review uncommitted changes
- Another runbook references this runbook

## When NOT to Use

- User wants to compare against a base branch (use [check-git-branch-diff](check-git-branch-diff.md))
- User wants to review staged changes

## Tips

- **Start with file list, not full diff.** Always check `--name-only` first and read full diffs selectively.
- **Ignore untracked files.** `git diff` only shows changes to tracked files. Untracked files require `git status` to discover.

## Workflow

### 1. Get an Overview

Run in parallel:

```bash
git status -sb
git diff --name-only
```

### 2. Read Diffs Selectively

For each relevant file or group of files:

```bash
git diff -- <path>
```

Focus on files related to the main topic. Skip temporary files, lock files, auto-generated files, and tool metadata (e.g. `.claude/`, `PLAN.md`).
