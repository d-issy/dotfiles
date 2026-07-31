---
name: pi-customization
description: Use when customizing Pi extensions, tools, focuses, prompts, themes, keybindings, providers, skills, or other Pi behavior. Use pi-agent-user-settings instead for .pi/settings.user.json.
---

# Pi Customization

- Treat the installed `node_modules/@earendil-works/pi-coding-agent` package as the version-matched source of truth. Prefer its relevant documentation and examples; inspect `src/` only when needed. Use the local Pi checkout only when the installed package is unavailable.
- Store persistent dotfiles in the matching repository path:
  - `files/pi/agent/` for global Pi files
  - `files/pi/agent/extensions/user/` for the user extension
  - `tests/pi/agent/extensions/user/` for its tests
  - `files/agent-skills/` for agent skills
- Deploy through `modules/recipes/pi.nix` and `modules/recipes/agent-skills.nix`; never write directly under the home directory.
- Preserve the user extension's feature/lib/test structure and update tests for behavior changes.
- Prefer documented behavior. When documentation and implementation disagree, report it and follow the installed implementation for behavior-sensitive work.
