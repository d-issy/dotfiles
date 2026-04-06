# Create Pull Request Body

Generate a pull request body from the diff against the base branch and copy it to the clipboard.

## When to Use

- User asks to create, write, or draft a PR description, body, or summary
- User asks for a PR overview or summary
- User asks to copy a PR body to the clipboard

## When NOT to Use

- User wants to create the PR itself (use `gh pr create`)
- User wants to review someone else's PR

## Tips

- **Clipboard is the default destination.** Unless the user says otherwise, copy the result to the clipboard using the [copy-to-clipboard](copy-to-clipboard.md) runbook.
- **Match the repository's language.** If existing PRs, README, or commit messages are in English, write in English. If in Japanese, write in Japanese.

## Workflow

### 1. Check the Diff

Follow the [check-git-branch-diff](check-git-branch-diff.md) runbook to identify the base branch and review changes.
Skip if the changes are already well understood in the current session.

### 2. Check for a PR Template

Look for a PR template in the repository:

- `pull_request_template.md` (repository root)
- `.github/pull_request_template.md`
- `docs/pull_request_template.md`
- `.github/PULL_REQUEST_TEMPLATE/` (multiple templates)

Filename is case-insensitive.

If a template exists, use its structure for the body. If not, use a concise format: title, summary, and key changes.

### 3. Compose the Body

Based on the diff and the template (if any), compose the pull request body.

- If a template was found, follow its structure. The remaining rules still apply unless the template contradicts them.
- If no template, include a summary and background at minimum.
- Write for reviewers. Do not describe fine-grained diffs that are obvious from the code.
- Keep each line short and scannable. Use bullet points, not dense paragraphs.
- Focus on **what** changed and **why**. The diff already shows **how**.
- Do not add `Co-authored-by` or similar trailers.

### 4. Copy to Clipboard

Follow the [copy-to-clipboard](copy-to-clipboard.md) runbook to copy the body.
