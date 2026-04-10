# Delegate Tasks to Cursor Agent

Guide for invoking Cursor Agent from another agent harness to delegate sub-tasks.

## When to Use

- You want to delegate a task to a different model via Cursor Agent
- The task benefits from Cursor Agent's tooling (browser automation, MCP servers, etc.)

## When NOT to Use

- You are already running inside Cursor — use its built-in capabilities instead
- The task can be completed within your current harness without delegation

## Tips

- If your harness supports it, run this command in the background / asynchronously.
- Do not set a timeout — Cursor Agent tasks may take longer than default limits.

## Workflow

### 1. Run the Task and Get the Result

```bash
cursor-agent -p --force --model auto "<prompt>" 2>/dev/null
```

Replace `<prompt>` with a self-contained task description. Cursor Agent runs in a separate context and cannot see your conversation history.

When the task requires browser automation:

```bash
cursor-agent -p --force --browser "<prompt>" 2>/dev/null
```
