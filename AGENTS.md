# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS.

## Rules

- Do not read or access files under `~/` directly; always work through this repository
- Do not apply (switch) unless explicitly asked. When applying:
  - `git add` changed files under `files/` and `modules/` then `nix run . -- switch --flake .#<platform>`
  - linux: `.#linux`, macOS Silicon: `.#macos`, macOS Intel: `.#macos_intel`

## Structure

| Directory  | Purpose                                |
| ---------- | -------------------------------------- |
| `modules/` | Nix modules (imported by `common.nix`) |
| `files/`   | Application config files               |

Module pattern: `modules/[tool].nix` + `files/[tool]/`

## Adding / Modifying Tools

1. Find or create `modules/[tool].nix`
2. Config files go in `files/[tool]/`
3. New modules must be imported in `modules/common.nix`
4. Remind to `git add` new files (Nix Flakes only tracks git-managed files)
