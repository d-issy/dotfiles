# Orchestrate Subagents

Keep half of Pi's pane for Pi; divide the other half equally among subagents. Requires Pi inside Herdr; preserve other panes.

## Plan

- Assign each agent a unique name, preset, bounded task, and edit permission. Names must match `[a-z][a-z0-9_-]{0,31}`.
- Choose from [Presets and layout](references/presets-and-layout.md). Unless the user specifies an effort level, use the lowest available effort for the selected model family. Use `pi` for Pi testing (no model override), `terra-high` for web research.
- Parallelize independent work, including edits in the same working tree. Assign editors non-overlapping files or sections; sequence overlapping or dependent tasks.

## Start

Start all agents in one call:

```sh
herdr-subagents start architect=opus-high reviewer=sol-high researcher=terra-high
```

- Preserves Pi focus, resolves model versions, and returns live status as JSON. See [layout details](references/presets-and-layout.md#layout).
- Never split or resize panes directly. After partial startup, inspect `herdr-subagents status` instead of starting another layout.

## Verify readiness

- Before prompting, inspect every agent with `herdr agent get <name>` and `herdr agent read <name> --source recent-unwrapped --lines 80`. Require a live agent with its normal empty input UI; startup success or `idle` alone is insufficient.
- If an agent disappeared, inspect its recorded pane ID from `herdr-subagents status`.
- For unexpected startup content (updates, authentication, onboarding, approvals, errors), preserve the pane and report required user action. Do not prompt, send keys, or resolve startup/authentication without explicit approval.

## Delegate and collect

- Provide each agent its task, context, constraints, and output format. Tell editors to stay within scope, preserve others' changes, and report needed out-of-scope edits.
- Once all agents pass readiness checks, run `herdr agent prompt <name> <task> --wait --timeout 600000` concurrently via parallel tool calls or background jobs, then join them. Never use a sequential blocking loop. Wait up to 10 minutes, returning when settled; avoid frequent polling.
- `prompt --wait` observes post-submission state changes. A separate `wait` after a nonblocking prompt may return pre-task `idle`; this is not completion.
- Inspect state and collect results with `herdr agent read <name> --source recent-unwrapped`. Confirm each result answers its task, then verify and synthesize.
- On timeout or `agent_prompt_stalled`, inspect before retrying; never blindly duplicate tasks. Use `herdr agent wait` for confirmed running tasks.
- `blocked` requires user input; never answer approvals or questions for the user. `unknown` is not completion.

## Cleanup

- After capturing all successful results, run `herdr-subagents cleanup`. It closes this Pi pane's recorded idle, done, or stopped agent panes; preserves working, blocked, unknown, or failed panes.
- On collection failure, blocked agents, or user inspection requests, preserve panes and report that cleanup remains available.
- Recover after interruption with `herdr-subagents status`.
- Never use `herdr-subagents cleanup --force` without explicit approval; it can terminate active agents.
