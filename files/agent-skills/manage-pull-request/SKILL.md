---
name: manage-pull-request
description: Use for creating, drafting, publishing, or updating GitHub pull requests; pair with the active publishing workflow to enforce the PR title, body, draft state, and publication preflight rules. Do not use for reviewing someone else's pull request.
---

# Manage Pull Request

- When combined with a publishing skill, follow that skill for staging, commits, pushing, and creation mechanics. This skill's rules take precedence for the pull request title, body, draft state, and publication preflight checks.
- Ensure network access before GitHub CLI operations. Do not use `gh auth status` as a preflight check; run it only after an explicit authentication failure.
- Treat connection or API reachability failures as network failures. This rule overrides conflicting publishing-workflow preflight instructions.
- Base the title and body on the relevant diff, match the language of existing pull requests and commits, and use the repository pull request template when present.
- Keep the title to one line and state the intent.
- Explain what changed and why, focusing on context reviewers need. Without a template, use `## Summary` and `## Background`.
- Reuse any title or body supplied by the user.
- Do not list routine work already handled by CI/CD, such as formatting, linting, tests, builds, or deployments. Mention it only when requested, required by the template, or when a notable result affects the review.
- Commit only task-related changes.
- Do not amend, rebase, or force-push unless explicitly requested.
- Never push the repository's default branch.
- Create the pull request as a draft.
