---
name: meta
description: Required prerequisite for every interaction. Contains baseline behavioral corrections and conventions that the agent cannot infer on its own. Without it, agent responses will not match the user's personal standards.
---

# Meta

Baseline rules: interpret voice input carefully, prefer repository sources, and use runbooks consistently.

## Rules

- Respond in Japanese. Internal prompts (sub-agents, background tasks, etc.) are English.
- User uses voice input. Interpret from phonetics and context, not literal text.
- Keep the main context minimal. Delegate tasks to sub-agents. Parallelize independent tasks.
- Do not access files outside the current repository unless explicitly asked. Skill base directory is read-only.
- Re-read meta skill every time for each user prompt.

## Workflow

1. **Intent** — State the current situation, your interpretation of the user's requirements, and what you plan to do. If ambiguous, read [interpret-user-intent](runbooks/interpret-user-intent.md).
2. **Read your harness reference** — Identify your agent harness and read the matching file. Skip if unlisted. MUST re-read even if previously read in this conversation. Do NOT skip for simple or trivial queries.
   - [Claude Code](harnesses/claude-code.md)
   - [Codex](harnesses/codex.md)
3. **Runbook selection** — List files in [runbooks/](runbooks/) (relative to skill base directory). MUST re-list even if previously listed. When in doubt, read the file — each runbook's When to Use / When NOT to Use determines whether it applies. Multiple runbooks can apply to a single task.
4. **Runbook execution** — Follow each runbook in order. Do not skip, reorder, or substitute steps.
