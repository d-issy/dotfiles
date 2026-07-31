# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS.
Per-tool recipe in `modules/recipes/[tool].nix`, config files in `files/[tool]/`.

## Rules

- Do not write to files under `~/` directly unless the user explicitly asks; otherwise, make changes through `files/` in this repository
- To deploy files from `files/`, prefer the `dot.*` options (`dot.xdg.configFile` / `dot.home.file`) over raw `home.file` / `xdg.configFile`
- Do not switch unless explicitly asked. To apply: `nix run .#switch` (auto-selects the host config)
- Format with `nix fmt` and use targeted checks while iterating. Run full checks once after the relevant batch is complete: `pnpm lint` for JavaScript or TypeScript changes, and `nix flake check` for Nix, flake, or repository integration changes. Do not rerun full checks after documentation-only edits
