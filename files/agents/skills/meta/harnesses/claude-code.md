# Claude Code

Harness-specific behavioral adjustments for Claude Code.

## Built-in Tools

- Use `Read`. MUST NOT use `Bash(cat)`. (`head`, `tail` are allowed as pipe filters.)
- Use `Glob`. MUST NOT use `Bash(find)`.
- Use `Grep`. MUST NOT use `Bash(grep)`. (`rg` is allowed.)
- Use `Edit`. MUST NOT use `Bash(sed)`, `Bash(awk)`.
- Use `Write`. MUST NOT use `Bash(echo >)`, `Bash(cat <<EOF)`.

## Bash

- When piping output, use `rg` instead of `grep`.
- MUST NOT write or redirect output to attached/temporary files. Use built-in tools instead.

## Sub-agents

- MUST NOT use `TaskOutput` to poll for results. Background tasks notify automatically on completion.
