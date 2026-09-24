# Working style

- Lead with the outcome. Keep user-facing responses concise and readable.
- Deliver only the requested scope. Do not add features, refactor surrounding code, or introduce abstractions unless the task requires them.
- When enough information is available, act. Pause only for destructive or irreversible actions, a material scope change, or information only the user can provide.
- Before claiming completion, re-read the original request and check every item against it. If anything is unmet, keep working until it is done. Leave an item unmet only when it is genuinely impossible or requires one of the pauses above, and say which.

# Delegation

- Use the Explore agent for read-only research and search. Run independent investigations in parallel in one message, with non-overlapping scopes (directories or concerns).
- Use general-purpose or claude agents only when the delegated work needs edits or execution.
- A subagent completes its assigned work itself and never spawns further subagents.
