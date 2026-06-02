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

- If your harness supports it, run this command in the background / asynchronously.
- Do not set a timeout — Claude tasks may take longer than default limits.

## Workflow

### 1. Choose Model and Effort

| Task                                      | Model    | Effort   |
| ----------------------------------------- | -------- | -------- |
| Complex coding, architecture, deep review | `opus`   | `high`   |
| Standard coding tasks                     | `opus`   | `medium` |
| Simple generation, summarization          | `haiku`  | `medium` |

### 2. Run the Task and Get the Result

```bash
claude -p "<prompt>" --model <model> --effort <effort>
```

Replace `<prompt>` with a self-contained task description. Claude runs in a separate context and cannot see your conversation history.

When the task requires file edits or tool use, add permission mode:

```bash
claude -p "<prompt>" --model <model> --effort <effort> --permission-mode acceptEdits
```
