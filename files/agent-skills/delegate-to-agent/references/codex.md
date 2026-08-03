# Codex

Choose the lowest tier that fits:

| Model | Task | Published reference |
| --- | --- | --- |
| `gpt-5.6-luna` | Simple or routine work | AA Intelligence 51; AA Coding Agent 75; about 188 output tokens/s |
| `gpt-5.6-terra` | General coding and agent work | AA Intelligence 55; AA Coding Agent 77; about 136 output tokens/s |
| `gpt-5.6-sol` | Difficult, quality-first work | AA Intelligence 59; AA Coding Agent 80; about 66 output tokens/s |

```bash
codex exec "<prompt>" --model "<model>" --ephemeral --color never
```

Grant network access only when external research is required:

```bash
codex exec "<prompt>" --model "<model>" --ephemeral --color never -c 'sandbox_permissions=["network-full-access"]'
```

Do not include private repository content in prompts sent to external search.
