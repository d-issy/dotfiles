---
name: manage-agent-skills
description: Use when adding, splitting, merging, or refining skills in this dotfiles repository, including with skill-management skills like skill-creator. These rules take precedence over conflicting guidance from those skills, including official or built-in ones.
---

# Manage Agent Skills

Maintain skills in this repository. Choose their scope first, then update their content and metadata.

## Precedence

When other skill-management skills or workflows conflict with this skill, follow this skill within this dotfiles repository. This includes `skill-creator` and other official or built-in skills, but does not override higher-priority instructions. There is no need to reload this file for each operation.

## 1. Choose the location

| Scope | Source location | Deployment |
| --- | --- | --- |
| Specific to this dotfiles repository | `.agents/skills/<skill-name>/SKILL.md` | Project-local only; do not deploy globally |
| Reusable across other projects | `files/agent-skills/<skill-name>/SKILL.md` | Shared deployment through Nix |

Edit these repository sources, never deployed copies under the home directory.

Before adding a skill, check for overlapping responsibilities. Prefer refining an existing skill; split or merge only to keep one coherent responsibility per skill.

## 2. Maintain metadata

### Project-local skills

- Keep metadata in the `SKILL.md` frontmatter.
- Do not register the skill for global deployment.

### Shared skills

- Keep metadata, invocation policy, and targets in `modules/recipes/agent-skills.nix`.
- Match the recipe skill key to the skill folder name.
- Keep target-specific serialization in `dot.programs.agent-skills`, not in the skill content.

### Metadata wording

- `description`: when to use the skill.
- `summary`, where supported: a short display description of its purpose.
- `starterPrompt`, where supported: a user request that invokes the skill.
- Keep detailed execution rules in the skill body. When a skill must accompany or take precedence over other skills, state that trigger and precedence in `description` so agents can discover it before loading the body.

## 3. Write the instructions

- Keep repository-specific knowledge, non-obvious constraints, and reusable automation.
- Remove instructions the target agents already follow reliably.
- Move variant-specific or detailed material into directly linked `references/` files.

## 4. Verify

- Check that the location, metadata, and deployment match the skill's scope.
- Check that referenced files exist and the instructions remain consistent.
- Follow the formatting, verification, and deployment rules in the repository's `AGENTS.md`.
