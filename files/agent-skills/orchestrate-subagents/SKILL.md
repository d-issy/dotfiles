# Orchestrate Subagents

Use Pi as the main agent in the left pane and delegate independent work to supported coding agents in an equally divided right-hand pane column.

## Plan and confirm

- The skill may identify a useful delegation opportunity, but it must not create panes or start agents until the user approves the proposed delegation for the current task.
- Propose a small set of independent roles. For each role, show its unique name, preset, bounded task, and whether it may edit files. Ask the user to approve or revise the complete proposal.
- Choose from these stable presets; each resolves its model family to the latest version at launch:
  - `sol`: Codex Sol at medium reasoning.
  - `sol-high`: Codex Sol at high reasoning.
  - `terra`: Codex Terra at high reasoning.
  - `luna`: Codex Luna at xhigh reasoning.
  - `opus`: Claude Opus at high effort.
  - `fable`: Claude Fable at medium effort.
  - `fable-high`: Claude Fable at high effort.
  - `grok`: Cursor Grok high-fast.
  - `composer`: the latest standard Cursor Composer model.
- Approval from an earlier task does not carry forward. Do not interpret general interest in subagents, skill installation, reload, or testing as approval for a new delegation.

## Start

- This workflow requires Pi to be running inside Herdr and to be the only pane in the current tab.
- After approval, start the complete layout in one call:

  ```sh
  herdr-subagents start architect=opus reviewer=sol-high researcher=grok
  ```

- Use lowercase unique names matching `[a-z][a-z0-9_-]{0,31}`.
- The command keeps Pi focused on the left, creates an equal-width right column, divides that column equally among subagents, resolves current model versions, starts each agent, and returns their live status as JSON.
- Do not invoke raw pane split or resize commands for this workflow. If startup is partial, inspect `herdr-subagents status`; do not create another layout over it.

## Verify readiness

- Do not treat a successful start or an `idle` lifecycle state alone as proof that an agent is ready for a task.
- Before sending any prompt, inspect every agent with `herdr agent get <name>` and `herdr agent read <name> --source recent-unwrapped --lines 80`. Confirm that it remains live and shows its normal empty input UI.
- If a named agent has disappeared, read its recorded pane ID from `herdr-subagents status` and inspect that pane directly.
- Do not send a task when the terminal shows an update, login or QR flow, expired credentials, onboarding, an approval dialog, an error, or any other unexpected startup content. Preserve the pane and tell the user what action is required.
- Do not send keys or attempt to complete startup or authentication without explicit user approval.

## Delegate and collect

- Give every subagent a bounded task, relevant context, constraints, and an explicit output format.
- Parallelize research, analysis, and review. Do not allow multiple agents to edit the same working tree concurrently. Use one editing agent unless the user explicitly requests isolated worktrees.
- Only after every intended agent passes the readiness inspection, send prompts by unique agent name with `herdr agent prompt`. Send all independent prompts before waiting so the work can run concurrently.
- Wait with `herdr agent wait`, then inspect state and collect output with `herdr agent read --source recent-unwrapped`.
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
