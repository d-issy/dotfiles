---
name: manage-pull-request
description: Always use together with any skill or workflow that drafts, creates, publishes, or updates a pull request. This companion skill owns the pull request title, body, draft state, and publication preflight prohibitions; it does not replace the publishing workflow. Do not use to review someone else's pull request.
---

# Manage Pull Request

- When combined with a publishing skill, follow that skill for staging, commits, pushing, and creation mechanics. This skill's rules take precedence for the pull request title, body, draft state, and publication preflight checks.
- Do not run `gh auth status` before the required GitHub operation. Diagnose authentication only after that operation fails for an authentication reason.
- Base the title and body on the relevant diff, match the language of existing pull requests and commits, and use the repository pull request template when present.
- Keep the title to one line and state the intent.
- Explain what changed and why, focusing on context reviewers need. Without a template, use `## Summary` and `## Background`.
- Reuse any title or body supplied by the user.
- Do not list routine work already handled by CI/CD, such as formatting, linting, tests, builds, or deployments. Mention it only when requested, required by the template, or when a notable result affects the review.
- Commit only task-related changes.
- Do not amend, rebase, or force-push unless explicitly requested.
- Never push the repository's default branch.
- Create the pull request as a draft.
