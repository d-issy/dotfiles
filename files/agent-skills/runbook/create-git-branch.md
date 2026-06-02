# Create Git Branch

Create a new branch from the current state.

## When to Use

- User asks to create or cut a branch
- User is on the main branch and needs to make changes

## When NOT to Use

- User asks to implement a task — do not create a branch unless explicitly requested
- A feature branch already exists for the current task

## Tips

- **Inspect local changes before naming.** If there are pending changes, the branch name should reflect their purpose.
- **Match the project's convention.** Check existing branch names and follow the same pattern (prefixes, casing, etc.).
- **Be descriptive.** Avoid generic names like `work`, `changes`, or unexplained prefixes such as `chore/`.

## Workflow

### 1. Check the Current State

Run in parallel:

```bash
git branch --show-current
git branch -a
git rev-parse --abbrev-ref origin/HEAD
git status -sb
```

If already on a feature branch, confirm with the user before creating another. Note the naming convention of existing branches. Use the user-specified base branch, or default to the repository's default branch.

### 2. Understand Pending Work

If `git status -sb` shows modified, staged, or untracked files, inspect the change overview before choosing a branch name:

```bash
git diff --name-only
git diff --cached --name-only
git ls-files --others --exclude-standard
```

Read selective diffs for relevant tracked files, including staged changes when present:

```bash
git diff -- <path>
git diff --cached -- <path>
```

Skip lock files, generated files, and tool metadata unless they are the main change. Derive the branch name from the actual pending work, not from a generic task label.

### 3. Choose the Branch Name

Use a user-specified branch name when provided. Otherwise, derive one from the task context and pending changes. Match repository convention, but do not invent a prefix when the convention is unclear.

### 4. Create and Switch

```bash
git switch -c <branch-name> <base>
```
