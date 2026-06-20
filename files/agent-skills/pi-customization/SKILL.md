---
name: pi-customization
description: Use when customizing Pi behavior, extensions, custom tools, focuses, prompts, themes, keybindings, or skills. Prefer the installed Pi package under node_modules/@earendil-works/pi-coding-agent for docs and examples.
---

# Pi Customization

Use this skill when the user wants to customize Pi itself or this dotfiles repository's Pi setup, including:

- user/global Pi extensions under `files/pi/agent/extensions/`
- custom tools, commands, events, UI, providers, prompts, themes, keybindings, or skills
- focus behavior and focus-related extension code
- Pi customization design questions where installed Pi package docs or examples should be consulted

Do not use this skill for ordinary project coding tasks, generic Nix/Home Manager changes, or `.pi/settings.user.json` project tool/focus settings only. For `.pi/settings.user.json`, use the `pi-agent-user-settings` skill instead.

## Reference source of truth

Prefer the installed Pi package under this repository's `node_modules` so references match the Pi version currently used by the project:

- Pi package: `node_modules/@earendil-works/pi-coding-agent`
- Docs: `node_modules/@earendil-works/pi-coding-agent/docs`
- Examples: `node_modules/@earendil-works/pi-coding-agent/examples`
- Extension examples: `node_modules/@earendil-works/pi-coding-agent/examples/extensions`
- Implementation source, when needed: `node_modules/@earendil-works/pi-coding-agent/src`
- Local Pi repository fallback, if `node_modules` is unavailable: `~/code/github.com/earendil-works/pi/packages/coding-agent`

When working on Pi customization:

1. Read the relevant installed docs first.
2. Follow cross-references in those docs when they are relevant.
3. Read installed examples for the closest matching pattern.
4. Read implementation source only when docs/examples do not answer the question or when behavior must match current code.
5. Avoid relying on unrelated checkouts unless `node_modules` is unavailable or the user explicitly asks.

## Common doc entry points

- Extensions, custom tools, events, commands: `docs/extensions.md`
- TUI components and custom UI: `docs/tui.md`
- Skills: `docs/skills.md`
- Prompt templates: `docs/prompt-templates.md`
- Themes: `docs/themes.md`
- Keybindings: `docs/keybindings.md`
- SDK integrations: `docs/sdk.md`
- Custom providers: `docs/custom-provider.md`
- Models/providers: `docs/models.md`, `docs/providers.md`
- Packages: `docs/packages.md`
- Settings: `docs/settings.md`

## Dotfiles layout

In this repository, Pi customization is managed through dotfiles:

- Global Pi files live under `files/pi/agent/`.
- The Home Manager recipe exposes them via `modules/recipes/pi.nix`.
- User extension code lives under `files/pi/agent/extensions/user/`.
- Tests for the user extension live under `tests/pi/agent/extensions/user/`.
- Agent skills live under `files/agent-skills/` and are enabled from `modules/recipes/agent-skills.nix`.

Do not write directly under `~/.pi` unless the user explicitly asks to test live sandbox behavior. Make persistent changes through `files/` and recipes in this repository.

## Workflow

1. Clarify the customization goal and whether it is best handled by a Pi extension, skill, prompt, keybinding, theme, setting, or dotfiles recipe.
2. Inspect the existing dotfiles implementation before proposing changes.
3. Read the relevant installed Pi docs and examples listed above.
4. If changing `files/pi/agent/extensions/user/`, follow existing feature/lib/test structure and add or update tests when behavior changes.
5. Keep customization scoped and deterministic; avoid broad hooks or global behavior changes unless requested.
6. Format and verify using the repository's normal checks when appropriate.

## Notes

- For extension hot reload behavior, prefer auto-discovered locations such as `~/.pi/agent/extensions/`; in this repository that maps from `files/pi/agent/extensions/` through Home Manager.
- For project-local user settings (`.pi/settings.user.json`), keep the separate `pi-agent-user-settings` skill authoritative.
- When docs and local implementation disagree, mention the discrepancy and prefer the local implementation for behavior-sensitive changes.
