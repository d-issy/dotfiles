# Delegate Tasks to Claude

Guide for invoking Claude Code from another agent harness to delegate sub-tasks.

## When to Use

- You want to delegate a task to a different model via Claude Code
- The task benefits from Claude Code's tooling or model behavior

## When NOT to Use

- You are already running inside Claude Code
- The task can be completed within your current harness without delegation
- The task needs a long interactive back-and-forth instead of a one-off result

## Tips

- Prefer `-p` for isolated delegation. Use `--continue` or `--resume` only when you intentionally want prior Claude session context.
- Keep prompts self-contained and include exact file paths, constraints, and expected output format.

## Workflow

### 1. Choose Model and Effort

| Task                                      | Model    | Effort   |
| ----------------------------------------- | -------- | -------- |
| Complex coding, architecture, deep review | `opus`   | `high`   |
| Standard coding tasks                     | `opus`   | `medium` |
| Simple generation, summarization          | `haiku`  | `medium` |

### 2. Check Execution Constraints First

Before delegating real work, decide whether the current harness can reach Claude's API. If the harness is sandboxed or network-restricted, run a minimal probe such as `claude -p "Reply with exactly: CLAUDE_OK" --model sonnet --effort low` in the current environment.

If the probe fails with a socket or network error, do not assume Claude is broken. Request the appropriate host-side approval or escalation before retrying.

Do not use Claude's `--dangerously-skip-permissions` or `bypassPermissions` to work around harness sandboxing. Those flags only affect Claude's own permission prompts; they do not grant network access or bypass the outer sandbox.

### 3. Run the Task and Get the Result

```bash
claude -p "<prompt>" --model <model> --effort <effort>
```

Replace `<prompt>` with a self-contained task description. Claude runs in a separate context and cannot see your conversation history.

If the task needs non-interactive file edits or tool use, add a permission mode that matches the environment:

```bash
claude -p "<prompt>" --model <model> --effort <effort> --permission-mode acceptEdits
```

Use `acceptEdits` for normal repository work. Only use `bypassPermissions` inside a sandboxed or no-network environment where unrestricted execution is acceptable.

### 4. Add Output or Directory Flags When Needed

Use structured output when another tool will parse the result:

```bash
claude -p "<prompt>" --model <model> --effort <effort> --output-format json
```

If the task needs access outside the current directory, explicitly grant it:

```bash
claude -p "<prompt>" --model <model> --effort <effort> --add-dir <path>
```

### 5. Handle Interruptions Before Explaining Status

If the user interrupts the turn or the command appears stuck, inspect the process table and recover any buffered session output before explaining what happened.

Confirm these in order:

- whether any `claude` process is still running
- whether the existing session already exited with output or an error
- whether the failure was caused by API connectivity, Claude permissions, or the outer harness sandbox

Do not speculate about status or results until you have checked the live process state and the captured command output.
