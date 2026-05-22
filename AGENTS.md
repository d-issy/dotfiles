# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS.

## Rules

- Do not read, write, or access files under `~/` directly; always work through this repository, except when the user explicitly asks to test sandbox behavior
- Only `git add` files that were changed as part of the current task
- Do not switch unless explicitly asked. When switching:
  - `git add` changed files under `files/`, `modules/`, and `flake.nix` as needed, then `nix run .#switch`
  - `.#switch` selects linux: `.#linux`, macOS Silicon: `.#macos`, macOS Intel: `.#macos_intel`

## Structure

| Directory  | Purpose                                |
| ---------- | -------------------------------------- |
| `modules/home/`     | Home Manager entry modules per platform |
| `modules/recipes/`  | Per-tool configuration recipes (HM `programs.<tool>` wrappers, file deployments, activation scripts, etc.) |
| `modules/programs/` | (reserved) Self-authored HM modules that define new `options.programs.<tool>` |
| `files/`            | Application config files                |

Module pattern: `modules/recipes/[tool].nix` + `files/[tool]/`
Platform entry modules: `modules/home/linux.nix`, `modules/home/macos.nix`

## Adding / Modifying Tools

1. Find or create `modules/recipes/[tool].nix`
2. Config files go in `files/[tool]/`
3. New modules must be imported in `modules/recipes/default.nix`
4. Remind to `git add` new files (Nix Flakes only tracks git-managed files)
