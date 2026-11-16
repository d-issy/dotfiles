# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS.
Per-tool recipe in `modules/recipes/[tool].nix`, config files in `files/[tool]/`.

## Rules

- Do not write to files under `~/` directly unless the user explicitly asks; otherwise, make changes through `files/` in this repository
- To deploy files from `files/`, prefer the `dot.*` options (`dot.xdg.configFile` / `dot.home.file`) over raw `home.file` / `xdg.configFile`
- Do not apply the configuration unless explicitly asked. To apply: `nix run .#apply` (auto-selects the host config)
- Treat an explicit apply request (including requests phrased as "switch") as authorization to `git add` any new files required by the configuration, then apply without asking for staging confirmation; Git flakes exclude untracked files. Do not stage unrelated files or commit unless explicitly asked.
- For conflict-resolution-only requests, keep the work limited to resolving conflicts. Mechanical resolutions that preserve both sides' existing changes (such as combining CI filters or package registrations) are exempt from the formatting and full-check requirements below. Verify the resolution diff, check for remaining conflict markers, and run `git diff --check`; do not run builds or full test/lint suites. If resolving a conflict requires new behavior, run only the focused checks needed for that behavior. Leave full validation to PR CI.
- Format changed files with `nix fmt`
- Choose verification based on the change scope:
  - Run `nix flake check` for Nix/Home Manager, flake, repository tooling, or GitHub Actions changes; it runs treefmt, deadnix, statix, oxlint, actionlint, and zizmor
  - Run `pnpm lint` and `pnpm typecheck` for TypeScript/JavaScript, `tsconfig`, or package/dependency changes that can affect TypeScript checking
  - Run all applicable checks when a change spans both scopes; these checks are not required for documentation-only changes unless they affect tooling or generated output
