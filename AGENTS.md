# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS.

## Rules

- Do not read, write, or access files under `~/` directly; always work through this repository, except when the user explicitly asks to test sandbox behavior
- Only `git add` files that were changed as part of the current task
- Do not apply (switch) unless explicitly asked. When applying:
  - `git add` changed files under `files/`, `modules/`, and `flake.nix` as needed, then `nix run .#switch`
  - `.#switch` selects linux: `.#linux`, macOS Silicon: `.#macos`, macOS Intel: `.#macos_intel`

## Structure

| Directory  | Purpose                                |
| ---------- | -------------------------------------- |
| `modules/home/`     | Home Manager entry modules per platform |
| `modules/programs/` | Shared Home Manager settings and program modules |
| `files/`            | Application config files                |

Module pattern: `modules/programs/[tool].nix` + `files/[tool]/`
Platform entry modules: `modules/home/linux.nix`, `modules/home/macos.nix`

## Adding / Modifying Tools

1. Find or create `modules/programs/[tool].nix`
2. Config files go in `files/[tool]/`
3. New modules must be imported in `modules/programs/default.nix`
4. Remind to `git add` new files (Nix Flakes only tracks git-managed files)
