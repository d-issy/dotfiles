# Cursor Agent

Choose by priority:

| Model | Task | Published reference |
| --- | --- | --- |
| `cursor-grok-4.5-high` | General default where quality and token efficiency matter | SWE-Bench Pro 64.7%; AA Intelligence 54; about 62 output tokens/s |
| `cursor-grok-4.5-high-fast` | High-effort Grok with lower latency | No separate public result |
| `cursor-grok-4.5-medium` | Balanced everyday Grok work | No separate public result |
| `cursor-grok-4.5-medium-fast` | Balanced Grok with lower latency | No separate public result |
| `composer-2.5-fast` | Fast interactive Composer work | AA Coding Agent 62; 6.7 min/task |
| `composer-2.5` | Cost-sensitive routine, batch, or background work | AA Coding Agent 62; 9.3 min/task; SWE-Bench Pro 54.0% |

```bash
agent -p --model "<model>" "<prompt>"
```

Do not bypass permission checks by default.
