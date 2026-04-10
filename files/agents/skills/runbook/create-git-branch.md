# Create Git Branch

Create a new branch from the current state.

## When to Use

- User asks to create or cut a branch
- User is on the main branch and needs to make changes

## When NOT to Use

- User asks to implement a task — do not create a branch unless explicitly requested
- A feature branch already exists for the current task

## Tips

- **Match the project's convention.** Check existing branch names and follow the same pattern (prefixes, casing, etc.).
- **Be descriptive.** The branch name should convey the purpose of the task.

## Workflow

### 1. Check the Current State

Run in parallel:

```bash
git branch --show-current
git branch -a
git rev-parse --abbrev-ref origin/HEAD
```

If already on a feature branch, confirm with the user before creating another. Note the naming convention of existing branches. Use the user-specified base branch, or default to the repository's default branch.

### 2. Create and Switch

```bash
git switch -c <branch-name> <base>
```

Derive the branch name from the task context. Match the naming convention of existing branches in the repository.
