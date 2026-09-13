# Orchestrate Subagents

Keep half of the current Pi pane for Pi and delegate independent work to supported coding agents in the equally divided other half.

## Plan

- Define a small set of independent roles based on the user's request. For each role, specify its unique name, preset, bounded task, and whether it may edit files. For editing roles, assign explicit, non-overlapping ownership of files or clearly bounded sections and identify any dependencies before delegation.
- Choose a preset from [Presets and layout](references/presets-and-layout.md). Use `terra` for web research tasks.

## Start

- This workflow requires Pi to be running inside Herdr. Other panes in the current tab are preserved.
- Start the complete layout in one call:

  ```sh
  herdr-subagents start architect=opus reviewer=sol-high researcher=terra
  ```

- Use lowercase unique names matching `[a-z][a-z0-9_-]{0,31}`.
- The command preserves Pi focus, resolves current model versions, starts each agent, and returns live status as JSON. See [layout details](references/presets-and-layout.md#layout).
- Do not invoke raw pane split or resize commands for this workflow. If startup is partial, inspect `herdr-subagents status`; do not create another layout over it.

## Verify readiness

- Do not treat a successful start or an `idle` lifecycle state alone as proof that an agent is ready for a task.
- Before sending any prompt, inspect every agent with `herdr agent get <name>` and `herdr agent read <name> --source recent-unwrapped --lines 80`. Confirm that it remains live and shows its normal empty input UI.
- If a named agent has disappeared, read its recorded pane ID from `herdr-subagents status` and inspect that pane directly.
- Do not send a task when the terminal shows an update, login or QR flow, expired credentials, onboarding, an approval dialog, an error, or any other unexpected startup content. Preserve the pane and tell the user what action is required.
- Do not send keys or attempt to complete startup or authentication without explicit user approval.

## Delegate and collect

- Give every subagent a bounded task, relevant context, constraints, and an explicit output format.
- Parallelize research, analysis, review, and independent editing tasks. Multiple editing agents may work concurrently in the same working tree; do not limit the workflow to one editing agent merely because they share a working tree.
- Give each editing agent explicit instructions limiting changes to its assigned files or sections and preserving other agents' changes. Agents must report needed changes outside their scope rather than making them. Delegate non-conflicting edits concurrently; sequence only overlapping or dependent work, assigning shared changes to a single owner.
- Only after every intended agent passes the readiness inspection, send prompts by unique agent name. Run independent `herdr agent prompt <name> <task> --wait --timeout 600000` calls concurrently (parallel tool calls or background shell jobs), then join all calls. This allows up to 10 minutes of waiting per call and returns sooner when the agent settles; do not replace it with frequent short polling. Do not run these blocking calls in a sequential loop.
- `prompt --wait` observes a state change after submission before waiting for a settled state. A separate `herdr agent wait` immediately after a nonblocking prompt can return the pre-task `idle` state; never treat that as completion.
- After the concurrent calls settle, inspect state and collect output with `herdr agent read --source recent-unwrapped`. Verify that each output answers the submitted task. On timeout or `agent_prompt_stalled`, inspect state and output before retrying; do not submit duplicate tasks blindly. Use `herdr agent wait` for an already confirmed running task.
- Treat `blocked` as requiring user input. Do not answer an approval or question on the user's behalf. Treat `unknown` as inconclusive, not complete.
- Verify and synthesize subagent results rather than forwarding them uncritically.

## Cleanup

- After all successful results have been captured, run:

  ```sh
  herdr-subagents cleanup
  ```

- Normal cleanup closes only panes recorded for this Pi pane whose agents are idle, done, or no longer running. It preserves working, blocked, unknown, or failed panes for inspection.
- Preserve panes when collection fails, an agent is blocked, or the user asks to inspect them. Report that cleanup is still available.
- Use `herdr-subagents status` to recover after interruption.
- Never use `herdr-subagents cleanup --force` without explicit user approval because it can terminate active agents.
