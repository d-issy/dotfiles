# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS.
Per-tool recipe in `modules/recipes/[tool].nix`, config files in `files/[tool]/`.

## Rules

- Do not write to files under `~/` directly; make changes through `files/` in this repository, except when the user explicitly asks to test sandbox behavior
- Only `git add` files that were changed as part of the current task
- `git add` new files before relying on them — Nix Flakes only sees git-tracked files
- To deploy files from `files/`, prefer the `dot.*` options (`dot.xdg.configFile` / `dot.home.file`) over raw `home.file` / `xdg.configFile`
- Do not switch unless explicitly asked. To apply: `nix run .#switch` (auto-selects the host config)
- Format with `nix fmt`; verify with `pnpm lint` and `nix flake check` (`nix flake check` runs treefmt, deadnix, statix, oxlint, actionlint, zizmor)
