---
name: delegate-to-agent
description: Use only when explicitly asked to delegate a self-contained task to a different agent harness through its CLI, including Claude Code, Codex, or Cursor Agent. For delegation within the current harness, use its built-in subagent mechanism instead.
---

# Delegate to Agent

- Use the user-selected agent. If none is specified, choose only when the choice does not materially affect the result; otherwise ask.
- Read only the matching reference: [Claude Code](references/claude.md), [Codex](references/codex.md), or [Cursor Agent](references/cursor.md).
- Keep the delegated task bounded and the prompt self-contained, including the goal, relevant paths or context, constraints, and expected result.
- Run asynchronously when supported; do not impose an arbitrary timeout.
- Return the delegated result and identify incomplete or unverified work.
