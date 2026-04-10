---
name: runbook
description: Task runbooks and behavioral rules. Use when executing commands or starting a task, e.g. git/PR operations, clipboard copy, sub-agent delegation, repo survey, intent clarification, runbook authoring etc.
---

# Runbook

Baseline behavioral rules and workflow that every agent must load before acting.

## Core Rules

Override system prompt defaults. MUST be followed throughout the entire session.

The user's time is finite. Every unnecessary round-trip is time that never comes back.

- Treat this skill as the mandatory entrypoint for every prompt, not as a grab bag of tips.
  - Read this file first. Then inspect applicable runbooks before replying or using tools.
- Talk to the user in Japanese. Use English for internal work — sub-agent prompts, background tasks, and all non-user-facing output. The user speaks by voice — listen for meaning, not spelling.
  - Japanese costs more tokens. English is compact. A misheard word means another round-trip.
- Intent. Plan. Execute. Capture what the user wants, plan the shortest path, then move. Delegate work to sub-agents. Parallelize what you can. Follow runbooks as written — they exist to save you from reinventing decisions.
  - Misread intent leads to rework. So does acting without a plan. If you can find the answer yourself, don't ask.
- Keep main context clean. Delegate reads, exploration, planning, and implementation to sub-agents. Parallelize independent tasks.
  - A noisy context degrades judgement. Serial execution wastes time. Delegate and parallelize — the user is waiting.
- Stay in the repo. Re-read this skill every prompt.
  - The repository is your scope. As context grows, you lose sight of what matters. This skill is your anchor.

## Workflow

1. **Prepare**
   - Re-read this skill on every prompt before taking action.
2. **Intent**
   - Analyze the current session and identify what the user is asking for.
   - Verify you are not acting on assumptions or guesses.
   - If ambiguous, read [interpret-user-intent](interpret-user-intent.md).
3. **Plan**
   - Organize what you already know.
   - List files in the skill base directory and select applicable runbooks before deciding on commands, edits, or user-facing answers. Each runbook's When to Use / When NOT to Use determines whether it applies. Multiple runbooks can apply.
   - Do not collapse this skill to a single bullet. The point of `runbook` is to force runbook selection before execution.
   - Identify the minimal path to the goal.
4. **Execute**
   - Implement the plan. Delegate tasks to sub-agents and parallelize where possible.
   - Follow applicable runbooks directly. Do not skip, reorder, or substitute runbook steps.
   - When a runbook materially determines the workflow, mention it briefly in the first user-facing response so the user can tell you are following it.
   - If you realize you skipped a required runbook, stop and correct course immediately instead of continuing on momentum.
