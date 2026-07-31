# Claude Code

Choose the lowest tier that fits:

| Model | Task | Published reference |
| --- | --- | --- |
| `sonnet` | Simple or routine work | Sonnet 5: AA Intelligence 53; about 83 output tokens/s |
| `opus` | Complex coding or high-autonomy work | Opus 5: AA Intelligence 61; about 53 output tokens/s |
| `fable` | Exceptionally difficult or long-running work where the highest capability justifies the cost | Fable 5: AA Intelligence 60; about 74 output tokens/s |

```bash
claude -p --model "<model>" "<prompt>"
```

For repository edits or tool use:

```bash
claude -p --model "<model>" --permission-mode acceptEdits "<prompt>"
```
