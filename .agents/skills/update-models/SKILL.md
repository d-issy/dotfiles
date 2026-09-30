---
name: update-models
description: Use whenever the user mentions new or updated AI models in this dotfiles repository, including indirect update notices, or asks to check or change model IDs, catalogs, presets, routing, or model-specific features such as Fast mode. Covers all providers used here, including OpenAI/Codex, Anthropic/Claude, Google/Gemini, and Cursor. For repository model updates, use this skill alongside any applicable provider documentation skill; a provider documentation skill alone does not cover the update workflow. Excludes general AI model news or comparisons unrelated to repository maintenance.
---

# Update Models in Dotfiles

## Determine scope and intent

- When no provider is specified, inventory the providers used by the repository and check each relevant provider. Include OpenAI/Codex, Anthropic/Claude, Google/Gemini, and Cursor models where configured; do not assume the current agent's provider is the whole scope. If a provider or model family is explicitly specified, keep the work within that scope.
- In repository maintenance context, an indirect model update notice is an implied request to investigate and implement necessary model updates. State the concrete proposal after investigating, then implement and verify it. Reserve a findings-only response for requests explicitly limited to checking, explaining, or auditing.
- This skill owns the repository update workflow. Use provider documentation skills when their scope applies; `openai-docs` covers official OpenAI information, not the other providers or the full repository workflow. Its use must not narrow an otherwise multi-provider request.

## Inventory before proposing

- Check current catalogs for each affected provider when available (for example, `codex debug models`, `cursor-agent --list-models`, and Pi's model catalog). Confirm releases, exact IDs, and feature support against the provider's official sources. Distinguish published models, account availability, client support, configured models, and aliases. If a catalog is inaccessible or empty, report that limitation rather than guessing or skipping the provider.
- Search the entire repository for the affected model families and versions, including `files/`, `modules/`, `tests/`, and agent instructions. Search for both exact IDs and related presets, aliases, and feature lists; do not assume a single command or configuration file owns a model.
- In particular, inspect `modules/dot/programs/scripts/herdr-subagents.nix`, `files/agent-skills/orchestrate-subagents/`, `files/pi/agent/extensions/user/features/fast.ts`, its tests, and `files/codex/AGENTS.md` when relevant. Check other matches found by the search, not just these examples.
- Identify dynamic version resolution separately from hard-coded IDs. Verify whether older versions remain intentionally supported before proposing their removal. Check whether a model-specific feature (such as Fast mode) actually supports a new model before enabling it.
- Check client version requirements and whether Pi uses bundled or refreshed catalog data. Adding a model to a feature allowlist alone does not make it selectable. Identify any client or catalog update still needed, and distinguish it from repository changes.

## Propose, then edit

- Present a concise, concrete proposal listing additions, replacements, removals, affected files, and any uncertain compatibility or behavior. Include relevant findings from the provider catalogs. If the request is only an audit, report findings without editing.
- For a clear update request, state the proposal and proceed without a separate approval round trip. Ask only when a material ambiguity or scope decision prevents a correct change, such as whether to retire older still-supported models or change unspecified effort levels.
- Keep model IDs and presets consistent across implementation, documentation, examples, and tests.
- Order model lists from higher-capability families to lower-capability families within each provider and generation, with newer versions first within a family. Preserve explicit reasoning-effort choices and supported older models unless their change or removal is requested.
- Finish the necessary edits and verification under `AGENTS.md`. Report what changed, what already follows new versions dynamically, verification results, and any remaining account/client/catalog limitation. Apply the configuration only when explicitly requested.
