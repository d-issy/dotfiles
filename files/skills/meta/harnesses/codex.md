# Codex

Harness-specific behavioral adjustments for Codex.

## Execution

- Treat the rules in this file as hard constraints. Re-check them before using tools and before replying.
- When the user asks for a change, make the change directly.
- Rely on notifications for running work. Do not poll with `wait_agent` or `write_stdin`.

## Response

- MUST NOT end completed work with optional follow-up offers such as "If needed, I can ...".

## Sub-agents

- Prefer `explorer` for questions and `worker` for owned code changes.
- Keep blocking work local.
- Use `spawn_agent` to start work and `send_input` to refine it.
- Assign clear ownership for code changes. Do not revert others' edits.
- Rely on notifications for running work. Do not poll with `wait_agent` or `write_stdin`.
