# AGENTS.md

Nix Flakes + Home Manager dotfiles for Linux/macOS.
Per-tool recipe in `modules/recipes/[tool].nix`, config files in `files/[tool]/`.

## Rules

- Do not write to files under `~/` directly unless the user explicitly asks; otherwise, make changes through `files/` in this repository
- To deploy files from `files/`, prefer the `dot.*` options (`dot.xdg.configFile` / `dot.home.file`) over raw `home.file` / `xdg.configFile`
- Do not apply the configuration unless explicitly asked. To apply: `nix run .#apply` (auto-selects the host config)
- Treat an explicit apply request (including requests phrased as "switch") as authorization to `git add` any new files required by the configuration, then apply without asking for staging confirmation; Git flakes exclude untracked files. Do not stage unrelated files or commit unless explicitly asked.

## Verification

Choose checks for the behavior or configuration actually changed, rather than file extensions alone. Use the smallest relevant check; leave full validation to PR CI unless requested or needed to verify a cross-cutting integration change.

- Review the final diff and run `git diff --check`. For mechanical conflict resolutions that preserve existing behavior, also check for remaining conflict markers; these checks are sufficient.
- Format changes covered by `treefmt.toml` with `nix fmt -- <changed-files>`.
- For Nix/Home Manager behavior changes, evaluate the affected configuration; build the affected package or check when evaluation alone cannot verify the change. Use the relevant lint checks for Nix code changes.
- For TypeScript/JavaScript behavior, type, or dependency changes, run `pnpm lint` and `pnpm typecheck`, plus the affected tests when behavior changes.
- For Rust behavior or dependency changes, run the affected crate's tests and Clippy. For other runtime behavior changes, run the relevant regression tests.
- For CI or repository tooling logic changes, run the corresponding validator or affected check.
- For documentation-only changes, review accuracy and links; run tooling only if the change affects generated output or executable examples.
- Use `nix flake check` when full flake validation is needed. It builds configured checks, including Home Manager, Rust, and regression tests—not just linters.
