# Push Git Branch

Push local work to the remote branch.

## When to Use

- User asks to push the current branch
- User asks to publish local commits or local changes
- Another runbook needs the branch to be available on `origin`

## When NOT to Use

- User explicitly asks to amend, rebase, or force-push
- The current branch is the repository's default branch
- There is no local work to publish

## Tips

- **Never rewrite history by default.** Do not amend, rebase, force-push, or use `--force-with-lease` unless the user explicitly asks.
- **Add a commit instead.** If there are uncommitted changes, create a new commit and push it.
- **Ask before risky branch operations.** If the safe path is unclear, stop and ask instead of guessing.

## Workflow

### 1. Check Local State

Check the current branch, upstream, and working tree state.

If the current branch is the repository's default branch, stop immediately. Do not commit or push.

If there are uncommitted changes, review them, stage only the task-related files, and create a normal new commit. Do not amend an existing commit.

### 2. Push

If the branch has no upstream, push with upstream tracking:

```bash
git push -u origin HEAD
```

If the branch already has an upstream, push normally:

```bash
git push
```
