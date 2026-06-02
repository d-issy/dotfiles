# Generate Pull Request Body

Generate a pull request body from the diff against the base branch.

## When to Use

- User asks to create, write, or draft a PR description, body, or summary
- User asks for a PR overview or summary
- User asks to copy a PR body to the clipboard
- Another runbook needs a PR body

## When NOT to Use

- User wants to review someone else's PR

## Tips

- **Clipboard copy is optional.** Copy standalone PR body/overview results by default, but skip copying when another runbook only needs the body as an internal value.
- **Treat PR overview as reusable PR text.** In this repository, requests like "PR overview" or "summary" mean the user wants copy-ready text, so copy them unless the user says not to.
- **Match the repository's language.** If existing PRs, README, or commit messages are in English, write in English. If in Japanese, write in Japanese.
- **Avoid redundant validation notes.** Do not add Checks, Tests, or Validation sections unless the user asks or the PR template requires them.

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
- Do not list commands or checks that CI already runs.
- Do not add `Co-authored-by` or similar trailers.

### 4. Copy to Clipboard (Optional)

Follow the [copy-to-clipboard](copy-to-clipboard.md) runbook when the user directly asked for a PR body, description, overview, or summary.

Skip this step when another runbook needs the body only as an internal value, unless the user also asked to copy it.
