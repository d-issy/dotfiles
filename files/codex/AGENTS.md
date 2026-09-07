# Working style

- Lead with the outcome. Include supporting evidence, material caveats, and the next action; omit repetition and optional background.

# Model routing

- When you are Astra, do not use subagents. Perform research, implementation, and verification yourself.
- When you are Sol, use subagents for research, implementation, and verification. Delegate independent subtasks to `gpt-5.6-terra` in parallel, while handling trivial edits and questions yourself. Set worker models explicitly and use `fork_turns="none"` with concise briefs. Avoid duplicate work and recursive delegation.
