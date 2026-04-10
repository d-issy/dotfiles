# Survey Repository Structure

Guide for surveying a repository's structure and conventions before summarizing them.

## When to Use

- User asks "what does this repo do?", "explain the structure", or similar
- You need context before making changes in an unfamiliar codebase

## When NOT to Use

- You already understand the repository from earlier in the conversation
- The task is scoped to a single file and doesn't require broader context
- The user has already provided sufficient context

## Tips

- **Breadth first, depth later.** Resist reading implementation files until you understand the overall layout.
- **Count, don't enumerate.** For directories with many files, say "42 components following `[Name].tsx` pattern" rather than listing all 42.
- **Use sub-agents** for large repos. Parallelize exploration of independent directories.
- **This runbook is optional.** Use it when the user wants a repository-level overview or when broad repository context is actually needed. Do not invoke it for narrower questions just because it might be helpful.
- **Follow the workflow exactly once you choose it.** This runbook is intentionally concrete; do not replace its required inputs with rough equivalents just because they seem faster.

## Workflow

### 1. Gather Context (parallel)

Run these in parallel to minimize latency. Complete all of them before reading implementation files, unless the user explicitly narrows the scope:

- `git ls-files` — required; gives the full file tree. Do not substitute `rg --files` or ad hoc globs unless `git ls-files` is unavailable.
- Read `README.md` — project description and usage
- Read `CLAUDE.md`, `AGENTS.md` — AI agent instructions and project conventions

If one of these inputs is missing or unavailable, say which one is unavailable and continue with that limitation explicitly called out.

### 2. Identify Patterns

From the file tree gathered in step 1, identify:

- **Directory convention** — how the project organizes code (e.g. `src/features/[name]/`, `modules/[tool].nix`)
- **Module pattern** — the recurring template for adding new units of functionality
- **Anomalies** — files or directories that break the pattern; these are often the most important

Only after step 1 is complete, read 2–3 representative modules if needed to confirm the pattern.

### 3. Summarize

Summarize what you understood. No fixed format — just convey:

- What the project is and what it does
- How it's organized
- The pattern for adding or modifying things

If you had to skip any required input from step 1, mention that limitation in the summary.
