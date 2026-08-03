---
name: manage-agent-skills
description: Use when adding, splitting, merging, or refining reusable agent skills under files/agent-skills in this dotfiles repository.
---

# Manage Agent Skills

- Treat `files/agent-skills/` as the source of truth; never edit deployed copies under the home directory.
- Prefer refining an existing skill when scopes overlap, and keep one coherent responsibility per skill.
- Keep only repository-specific knowledge, non-obvious constraints, or reusable automation. Remove instructions the target agents already follow reliably.
- Move variant-specific or detailed material to directly linked `references/` files.
- Keep the folder name and frontmatter `name` aligned. Keep `description` trigger-focused, and add agent-specific metadata only when required.
- Keep `agents/openai.yaml` and `modules/recipes/agent-skills.nix` synchronized with the skill when applicable.
- Validate changed skills and follow the repository's `AGENTS.md`.
