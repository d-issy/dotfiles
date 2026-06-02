# Generate Pull Request Title

Generate a pull request title.

## When to Use

- User asks to create, write, or draft a PR title
- Another runbook needs a PR title

## When NOT to Use

- User asks for a PR body or description (use [generate-pull-request-body](generate-pull-request-body.md))

## Tips

- **Match the repository's language.** Follow the same language used in existing PR titles and commit messages.

## Workflow

### 1. Check the Diff

Follow the [check-git-branch-diff](check-git-branch-diff.md) runbook to identify the base branch and review changes.
Skip if the changes are already well understood in the current session.

### 2. Compose the Title

- One line. Keep it short and descriptive.
- Summarize the intent of the change, not the implementation detail.

### 3. Copy to Clipboard (Optional)

Follow the [copy-to-clipboard](copy-to-clipboard.md) runbook when the user directly asked for a PR title, such as "give me a PR title" or "draft a PR title".

Skip this step when another runbook needs the title only as an internal value, unless the user also asked to copy it.
