---
name: update-models
description: Use when adding, replacing, retiring, or auditing AI model versions, model presets, or model-specific features in this dotfiles repository. State a concrete proposal before editing; avoid unnecessary approval round trips.
---

# Update Models in Dotfiles

## Inventory before proposing

- Check the current model catalogs for the affected providers when available (for example, `codex debug models`); distinguish available models from configured models and aliases. If a catalog is inaccessible, say so rather than guessing.
- Search the entire repository for the affected model families and versions, including `files/`, `modules/`, `tests/`, and agent instructions. Search for both exact IDs and related presets, aliases, and feature lists; do not assume a single command or configuration file owns a model.
- In particular, inspect `modules/dot/programs/scripts/herdr-subagents.nix`, `files/agent-skills/orchestrate-subagents/`, `files/pi/agent/extensions/user/features/fast.ts`, its tests, and `files/codex/AGENTS.md` when relevant. Check other matches found by the search, not just these examples.
- Identify dynamic version resolution separately from hard-coded IDs. Verify whether older versions remain intentionally supported before proposing their removal. Check whether a model-specific feature (such as Fast mode) actually supports a new model before enabling it.

## Propose, then edit

- Present a concise, concrete proposal listing additions, replacements, removals, affected files, and any uncertain compatibility or behavior. Include relevant findings from the provider catalogs. If the request is only an audit, report findings without editing.
- For a clear update request, state the proposal and proceed without a separate approval round trip. Ask only when a material ambiguity or scope decision prevents a correct change, such as whether to retire older still-supported models or change unspecified effort levels.
- Keep model IDs and presets consistent across implementation, documentation, examples, and tests.
