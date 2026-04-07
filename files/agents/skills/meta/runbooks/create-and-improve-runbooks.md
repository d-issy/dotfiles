# Create and Improve Runbooks

Guide for creating new runbooks and improving existing ones.

## When to Use

- User asks to create a new runbook
- User asks to improve or refine an existing runbook
- You notice a repeated workflow that would benefit from being codified

## When NOT to Use

- The task is a one-off that won't recur
- An existing runbook already covers the task adequately

## Tips

- **Shorter is better.** A runbook that gets read beats one that gets skimmed. Aim for under 80 lines.
- **Write for cold starts.** The agent may have no prior context when it reads the runbook. Don't assume shared knowledge from the conversation.
- **Imperative > descriptive.** "Run X" is better than "You might want to run X".

## Structure

Every runbook follows this layout:

```markdown
# Title

One-line description of what this runbook covers.

## When to Use
- Conditions that trigger this runbook

## When NOT to Use
- Conditions that should skip this runbook

## Tips (optional)
- Practical advice that doesn't fit in the workflow

## Workflow
### 1. Step Name
What to do and why.

### 2. Step Name
...
```

Key principles:

- **Harness-agnostic** — SKILL.md and runbooks are read by multiple agent harnesses. Do not reference harness-specific tools or behaviors. Put those in [harnesses/](../harnesses/) instead.
- **When to Use / When NOT to Use comes first** — the agent reads these to decide whether to continue. Keep them scannable.
- **Workflow is the core** — numbered steps, each with a clear action. Prefer imperative sentences.
- **Tips are optional** — only include if there are practical insights that don't belong in any step.

## Workflow

### 1. Confirm Working Directory

Runbook source files live in the dotfiles repository. If you are not in it, ask the user to switch to dotfiles first. Do NOT read or edit the deployed copies under `$HOME` — always work from the repository source.

### 2. Check Existing Runbooks

List files in the repository's `files/agents/skills/meta/runbooks/` and read any that might overlap with the topic. If an existing runbook covers adjacent ground, extend it instead of creating a new file.

### 3. Write or Revise

When **creating**, draft the content following the Structure template above. For each workflow step:

- **What** to do (action)
- **Why** it matters (one sentence, only if non-obvious)
- **How** to do it (specific commands, tools, or patterns)

When **improving**, re-read the file from scratch — don't rely on memory from earlier in the conversation.

In both cases:

- Every step should be actionable. Replace "consider doing X" with "do X when Y".
- Don't teach general programming or tool basics. Focus on non-obvious guidance.
- Be specific in When to Use / When NOT to Use — vague conditions lead to false matches.
- Respect repository-specific conventions. If a workflow uses shorthand like "PR overview" to mean "prepare copy-ready text", encode that convention explicitly instead of generalizing from one session.
- Choose verbs by effect. Use `generate-*` for text or content generation, `create-*` for state-changing actions such as making branches or files, and `copy-*` for clipboard actions.
- Omit defaults that do not need thought. Mention flags and options only when the user must choose them or when the default would be wrong for this workflow.

### 4. Review

Walk through the runbook as if you were an agent seeing it for the first time. Does each step have enough context to act on?

### 5. Place the File

- Path: `files/agents/skills/meta/runbooks/<name>.md`
- Naming: lowercase, hyphen-separated. Start with a base-form verb describing the action the user wants to perform. Prefer the most specific verb that matches the effect, such as `generate`, `create`, `copy`, `check`, `survey`, `delegate`, or `interpret`.
- `git add` and remind the user to apply
