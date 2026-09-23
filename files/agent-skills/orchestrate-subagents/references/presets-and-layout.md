# Presets and Layout

## Presets

- `pi`: Pi with `--no-session`, without model or reasoning overrides. Use for Pi testing.
- Other presets resolve their model family to the latest version at launch:
  - `astra`: Codex Astra at low reasoning.
  - `sol`: Codex Sol at medium reasoning.
  - `luna`: Codex Luna at xhigh reasoning.
  - `opus`: Claude Opus at medium effort.
  - `fable`: Claude Fable at low effort.
  - `grok`: Cursor Grok high-fast.
  - `composer`: the latest standard Cursor Composer model.

Use `sol` for web research.

## Layout

- The command splits only the current Pi pane in half and keeps Pi focused. It chooses left/right for a wide pane or top/bottom for a tall pane, approximating terminal cells as twice as tall as wide (left/right when columns >= 2 × rows). The other half is divided equally among subagents along the perpendicular axis. It resolves current model versions, starts each agent, and returns their live status as JSON.
