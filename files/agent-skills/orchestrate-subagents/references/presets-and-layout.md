# Presets and Layout

## Presets

- Choose from these stable presets; each resolves its model family to the latest version at launch:
  - `sol`: Codex Sol at medium reasoning.
  - `sol-high`: Codex Sol at high reasoning.
  - `terra`: Codex Terra at high reasoning.
  - `luna`: Codex Luna at xhigh reasoning.
  - `opus`: Claude Opus at high effort.
  - `fable`: Claude Fable at medium effort.
  - `fable-high`: Claude Fable at high effort.
  - `grok`: Cursor Grok high-fast.
  - `composer`: the latest standard Cursor Composer model.

- Use `terra` (Codex Terra) for web research tasks.


## Layout

- The command splits only the current Pi pane in half and keeps Pi focused. It chooses left/right for a wide pane or top/bottom for a tall pane, approximating terminal cells as twice as tall as wide (left/right when columns >= 2 × rows). The other half is divided equally among subagents along the perpendicular axis. It resolves current model versions, starts each agent, and returns their live status as JSON.
