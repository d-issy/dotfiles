# Manage Agent Skills

- Treat `files/agent-skills/` as the source of truth; never edit deployed copies under the home directory.
- Prefer refining an existing skill when scopes overlap, and keep one coherent responsibility per skill.
- Keep only repository-specific knowledge, non-obvious constraints, or reusable automation. Remove instructions the target agents already follow reliably.
- Move variant-specific or detailed material to directly linked `references/` files.
- Keep the folder name and recipe skill key aligned. Keep skill metadata, invocation policy, and targets in `modules/recipes/agent-skills.nix`; keep target-specific serialization in `dot.programs.agent-skills`.
- Validate changed skills and follow the repository's `AGENTS.md`.
