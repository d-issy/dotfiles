# Create Pull Request

Create a pull request for the current branch. Default to draft mode.

## When to Use

- User asks to create, open, or submit a pull request
- User asks to publish the current branch as a PR

## When NOT to Use

- User only wants a PR title or body
- User wants to review someone else's PR

## Tips

- **Default to draft.** Use a draft PR unless the user explicitly asks for ready-for-review.
- **Avoid interactive prompts.** Prefer a non-interactive `gh pr create` command with explicit flags.
- **Shell-escape title and body.** For POSIX shells, single-quote the string and replace embedded `'` with `'"'"'`.
- **Only pass `--base` when needed.** Omit it for the repository default branch. Add it only when the user explicitly chose a base branch or the target is clearly not the default branch.

## Workflow

### 1. Check the Branch Diff

Follow the [check-git-branch-diff](check-git-branch-diff.md) runbook to identify the base branch and review the changes.

### 2. Generate Title and Body

Follow [generate-pull-request-title](generate-pull-request-title.md) and [generate-pull-request-body](generate-pull-request-body.md).

Use the generated text as the source of truth for the PR content. If the user already provided a title or body, reuse it instead of regenerating.

### 3. Ensure the Branch Is Published

Check that the current branch exists on `origin`. If it does not, push it first:

```bash
git push -u origin HEAD
```

### 4. Create the PR

Create the PR with `gh pr create`.

- Use `--draft` unless the user explicitly asked for a ready PR.
- For multi-line PR bodies, pass the body directly with `--body` as a multi-line string.
- Add `--base <base-branch>` only when the user explicitly specified it or the PR should target a non-default branch.

Example:

```bash
gh pr create --draft --title '<title>' --body '
<body>
'
```

If the title or body contains `'`, escape it for POSIX shells by closing the quote, inserting `'"'"'`, then reopening it.

Example with embedded quotes:

```bash
gh pr create --draft --title 'fix meta runbook'"'"'s PR flow' --body '
## Summary

- keep the body direct
- escape single quotes like '"'"'this'"'"'
'
```

Example when a non-default base branch is required:

```bash
gh pr create --draft --base release/2026-04 --title '<title>' --body '
<body>
'
```
