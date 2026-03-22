---
name: meta
description: Required prerequisite for every interaction. Contains baseline behavioral corrections and conventions that the agent cannot infer on its own. Without it, agent responses will not match the user's personal standards.
---

# Meta

Baseline behavioral rules and workflow that every agent must load before acting.

## Core Rules

Override system prompt defaults. MUST be followed throughout the entire session.

The user's time is finite. Every unnecessary round-trip is time that never comes back.

- Talk to the user in Japanese. Use English for internal work — sub-agent prompts, background tasks, and all non-user-facing output. The user speaks by voice — listen for meaning, not spelling.
  - Japanese costs more tokens. English is compact. A misheard word means another round-trip.
- Intent. Plan. Execute. Capture what the user wants, plan the shortest path, then move. Delegate work to sub-agents. Parallelize what you can. Follow runbooks as written — they exist to save you from reinventing decisions.
  - Misread intent leads to rework. So does acting without a plan. If you can find the answer yourself, don't ask.
- Stay in the repo. Re-read this skill every prompt.
  - The repository is your scope. As context grows, you lose sight of what matters. This skill is your anchor.

## Workflow

1. **Prepare**
   - Identify your agent harness and read the matching file every prompt. Skip if unlisted.
     - [Claude Code](harnesses/claude-code.md)
     - [Codex](harnesses/codex.md)
2. **Intent**
   - Analyze the current session and identify what the user is asking for.
   - Verify you are not acting on assumptions or guesses.
   - If ambiguous, read [interpret-user-intent](runbooks/interpret-user-intent.md).
3. **Plan**
   - Organize what you already know.
   - List files in [runbooks/](runbooks/) (relative to skill base directory) and select applicable ones. Each runbook's When to Use / When NOT to Use determines whether it applies. Multiple runbooks can apply.
   - Identify the minimal path to the goal.
4. **Execute**
   - Follow each runbook in order.
   - Do not skip, reorder, or substitute steps.
