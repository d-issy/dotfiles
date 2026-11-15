# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS/NixOS.
Per-tool recipe in `modules/recipes/[tool].nix` (or `modules/recipes/[tool]/` for a directory), reusable options in `modules/dot/`, config files in `files/[tool]/`.

## Rules

- Do not write to files under `~/` directly unless the user explicitly asks; otherwise, make changes through `files/` in this repository
- To deploy files from `files/`, prefer the `dot.*` options (`dot.xdg.configFile` / `dot.home.file`) over raw `home.file` / `xdg.configFile`
- Do not apply the configuration unless explicitly asked. To apply: `nix run .#apply` (auto-selects the host config)
- Treat an explicit apply request (including requests phrased as "switch") as authorization to `git add` any new files required by the configuration, then apply without asking for staging confirmation; Git flakes exclude untracked files. Do not stage unrelated files or commit unless explicitly asked.
- Format changed files with `nix fmt`
- Choose verification based on the change scope:
  - Run `nix flake check` for Nix/Home Manager, flake, repository tooling, or GitHub Actions changes; it runs treefmt, deadnix, statix, oxlint, actionlint, and zizmor, builds the Home Manager activation package, runs the worktree, herdr-subagents, and neovim regression checks, and on Linux builds the NixOS fixture
  - Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` for TypeScript/JavaScript, `tsconfig`, or package/dependency changes that can affect TypeScript checking
  - Run all applicable checks when a change spans both scopes; these checks are not required for documentation-only changes unless they affect tooling or generated output
