# Working style

- Lead with the outcome. Keep user-facing responses concise and readable.
- When a repository's documentation and its existing code disagree, follow the conventions used in the existing code, and in your final reply point out each inconsistency you found between the documentation and the code.
- Deliver only the requested scope. Do not add features, refactor surrounding code, or introduce abstractions unless the task requires them.
- When enough information is available, act. Pause only for destructive or irreversible actions, a material scope change, or information only the user can provide.
- Before claiming completion, re-read the original request and check every item against it. If anything is unmet, keep working until it is done. Leave an item unmet only when it is genuinely impossible or requires one of the pauses above, and say which.

## Subagent models

- Set `model` explicitly when spawning a subagent.
- Read-only research and fact collection (Explore): `sonnet`. Have it return facts with `file:line` references and no evaluation or recommendations; the main session draws the conclusions.
- Summarizing given material (logs, threads, documents), labeling, and other mechanical work whose rules are fully fixed and require no judgment: `haiku`.
- Implementation, execution, and anything when unsure which model fits: `opus`.
- Design critique, architecture decisions, and other hard judgment calls: `fable`.
