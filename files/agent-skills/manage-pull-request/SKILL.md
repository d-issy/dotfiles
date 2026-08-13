---
name: manage-pull-request
description: Always use this skill alongside any skill or workflow that creates, drafts, publishes, updates, checks, or reviews a GitHub pull request.
---

# Manage Pull Request

- Determine the workflow mode before acting:
  - For create, draft, publish, or update workflows, apply the management rules below.
  - For check or review workflows, read the relevant PR metadata, description, diff, checks, comments, and reviews, then report findings only. Do not edit the working tree, commit, push, change PR metadata or state, resolve threads, or otherwise apply fixes. If implementation is needed, leave it for a separate change request.

- When combined with a publishing skill, follow that skill for staging, commits, pushing, and creation mechanics. This skill's rules take precedence for the pull request title, body, draft state, and publication preflight checks.
- In every workflow mode, do not run `gh auth status` as the first GitHub operation or as a preflight probe. Start with the required GitHub operation, including review and check operations; run `gh auth status` only after that operation fails specifically because of authentication, and only to diagnose the failure.
- Base the title and body on the relevant diff, match the language of existing pull requests and commits, and use the repository pull request template when present.
- Keep the title to one line and state the intent.
- Explain what changed and why, focusing on context reviewers need. Without a template, use `## Summary` and `## Background`.
- Reuse any title or body supplied by the user.
- Do not list routine work already handled by CI/CD, such as formatting, linting, tests, builds, or deployments. Mention it only when requested, required by the template, or when a notable result affects the review.
- Commit only task-related changes.
- Do not amend, rebase, or force-push unless explicitly requested.
- Never push the repository's default branch.
- Create the pull request as a draft.
