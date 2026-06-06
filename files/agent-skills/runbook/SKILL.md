---
name: runbook
description: Task-specific runbooks for multi-step repository and workflow operations. Use when the user asks to create/push branches, create PRs, copy to clipboard, delegate tasks, clarify intent, or create/improve runbooks. Do not use for casual Q&A, short explanations, simple git diff checks, or simple follow-up questions.
---

# Runbook

Guidance for selecting and following task-specific runbooks.

- Use this skill only when a task-specific runbook may apply.
- List runbook files in this skill directory before planning.
  - Include symlinked files. Do not rely on filters that exclude symlinks, such as `find ... -type f`.
  - If the list is unexpectedly empty after loading this file, inspect the directory without type filters before concluding no runbooks exist.
- Select applicable runbooks by their When to Use / When NOT to Use.
- Follow selected runbooks directly; do not skip, reorder, or substitute steps.
- If multiple runbooks apply, use all relevant runbooks in the needed order.
- If no runbook applies, proceed without this skill.
