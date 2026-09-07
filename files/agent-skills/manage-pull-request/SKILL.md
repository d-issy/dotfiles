# Manage Pull Request

## Precedence

When combining PR skills or workflows, these rules take precedence over conflicting instructions in those skills, including official or built-in skills. This does not override higher-priority instructions. Apply these rules without reloading this file for each PR operation.

Use publishing skills for staging, commits, pushing, and creation mechanics where they do not conflict with these rules.

## Actions

- For create, draft, publish, or update workflows, apply the management rules below.
- For check or review workflows, read the relevant PR metadata, description, diff, checks, comments, and reviews, then report findings only. Do not edit the working tree, commit, push, change PR metadata or state, resolve threads, or otherwise apply fixes. If implementation is needed, leave it for a separate change request.

## Workflow Constraints

- Do not check for `gh` installation or authentication as a preflight. Start with the required GitHub operation; diagnose the tool or authentication only if that operation fails for that reason.
- Do not follow an agent-specific branch-naming convention, such as `agent/...` or `claude/...` prefixes. Use the existing branch or the repository's conventions; when a new branch is needed and neither provides a clear choice, use a concise, descriptive name based on the change scope.
- Do not make tests or checks a pull-request publication prerequisite. Run them when the user, repository, or change scope calls for them.

## Pull Request Content

- Base the title and body on the relevant diff, match the language of existing pull requests and commits, and use the repository pull request template when present.
- Reuse any title or body supplied by the user.
- Keep the title to one line and state the intent.
- Do not describe code changes that are apparent from the diff. Explain why the change is needed and provide reviewer-relevant context; without a template, use `## Summary` and `## Background`.
- Do not list routine work already handled by CI/CD, such as formatting, linting, tests, builds, or deployments. Mention it only when requested, required by the template, or when a notable result affects the review.

## Git and Branch Safety

- Commit only task-related changes.
- Do not add `Co-authored-by` or other author-attribution trailers unless explicitly requested.
- Do not amend, rebase, or force-push unless explicitly requested.
- Never push the repository's default branch.

## Pull Request State

- Create the pull request as a draft unless the user explicitly requests auto-merge. Enable auto-merge only when explicitly requested, and mark the pull request ready for review when required to enable it.
