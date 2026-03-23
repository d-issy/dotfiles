# Delegate Tasks to Codex

Guide for invoking Codex from another agent harness to delegate sub-tasks.

## When to Use

- You want to delegate a task to a different model via Codex
- The task benefits from Codex's sandboxed execution environment

## When NOT to Use

- You are already running inside Codex — use its built-in sub-agent capabilities instead
- The task can be completed within your current harness without delegation

## Tips

- If your harness supports it, run this command in the background / asynchronously.
- Do not set a timeout — Codex tasks may take longer than default limits.

## Workflow

### 1. Choose Model and Effort

| Task | Model | Reasoning Effort |
|------|-------|------------------|
| Complex coding, architecture, refactoring | `gpt-5.4` | `high` |
| Standard coding tasks | `gpt-5.3-codex` | `medium` |
| Simple generation, summarization | `gpt-5.3-codex` | `low` |

### 2. Run the Task and Get the Result

```bash
codex exec "<prompt>" --ephemeral --full-auto --color never --model <model> -c "model_reasoning_effort=\"<effort>\"" 2>/dev/null
```

Replace `<prompt>` with a self-contained task description. Codex runs in a separate context and cannot see your conversation history.

When the task requires web access (e.g. external research), add network permission:

```bash
codex exec "<prompt>" --ephemeral --full-auto --color never --model <model> -c "model_reasoning_effort=\"<effort>\"" -c 'sandbox_permissions=["network-full-access"]' 2>/dev/null
```

Only use this when external research is necessary. Do not include repository contents in the prompt — avoid leaking internal information to external search.
