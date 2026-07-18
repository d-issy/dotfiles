# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS.
Per-tool recipe in `modules/recipes/[tool].nix`, config files in `files/[tool]/`.

## Rules

- Do not write to files under `~/` directly unless the user explicitly asks; otherwise, make changes through `files/` in this repository
- To deploy files from `files/`, prefer the `dot.*` options (`dot.xdg.configFile` / `dot.home.file`) over raw `home.file` / `xdg.configFile`
- Do not switch unless explicitly asked. To apply: `nix run .#switch` (auto-selects the host config)
- Format with `nix fmt`; verify with `pnpm lint` and `nix flake check` (`nix flake check` runs treefmt, deadnix, statix, oxlint, actionlint, zizmor)
