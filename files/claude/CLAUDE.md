# Global Claude Code Instructions

## Language Settings

- Always respond in the same language as the user's message
- If the user writes in Japanese, respond in Japanese
- If the user writes in English, respond in English
- Code comments and documentation should follow the project's existing language conventions
- User may use voice input which can result in typos or misheard words - interpret based on context and intent

## General Development

- Always check existing code patterns before implementing
- Run linters and tests before committing
- Follow the project's existing code style
- Prefer using worktrees for complex changes or when explicitly requested
- When worktrees are requested, create worktree first, then commit in the worktree
- NEVER commit or push automatically - always wait for explicit user instruction
- Before committing, always display status using this exact template format:

```
## Pre-commit Status Check

**Current Location**: [pwd output]
**Branch**: [git branch --show-current output]
**Modified Files**:
- [list each modified file from git status --short, one per line]

[Action description - what will be committed]
```

Use this template exactly, then proceed with commit (user can interrupt if needed)

## Git Workflow

### Standard Git Workflow
For most changes, use standard Git workflow:

```bash
# Create feature branch from main
git switch main
git pull origin main
git switch -c feat/feature-name

# Make changes and commit
git add files
git commit -m "commit message"
git push -u origin feat/feature-name

# Create PR
gh pr create --draft
```

### Worktree Development Workflow (Optional - Use When Requested)

**Directory Structure:**
All worktrees should be created in `.worktree/` directory within the main repository:

```
project/
├── .git/
├── .worktree/                    # Worktree dedicated directory
│   ├── project-feat-auth/       # Authentication feature development
│   ├── project-fix-123/         # Issue #123 fix
│   └── project-exp-perf/        # Performance investigation
├── .gitignore
└── [normal project files]
```

**Safe Worktree Creation Flow:**

```bash
# Step 1: Pre-checks (MANDATORY)
git checkout main && git pull origin main && git status

# Step 2: Prepare .worktree directory
mkdir .worktree

# Step 3: Create worktree from latest main
git worktree add .worktree/project-feat-auth -b feat/auth

# Step 4: Start work in worktree
cd .worktree/project-feat-auth && claude
```

**Worktree Creation Patterns:**

```bash
# Feature development
git worktree add .worktree/[repo]-feat-[name] -b feat/[name]

# Bug fixes
git worktree add .worktree/[repo]-fix-[issue] -b fix/[issue]

# Experiments
git worktree add .worktree/[repo]-exp-[name] -b exp/[name]

# Existing branch
git worktree add .worktree/[repo]-[branch-name] [branch-name]
```

**Error Handling:**

```bash
# If uncommitted changes exist
git stash  # temporarily save changes

# If on wrong branch
git checkout main  # switch to main

# If behind remote
git pull origin main  # sync with remote
```

**Benefits of .worktree Directory Approach:**

- **No trust confirmation required** (within project directory)
- **Organized structure** (all worktrees in one place)
- **Simplified navigation** (shorter paths)
- **Clear identification** (repository name prefix for terminal display)

**Cleanup Workflow:**
When finished with a worktree, perform complete cleanup:

```bash
# 1. Return to main repository
cd [main-repository-path]

# 2. Remove worktree
git worktree remove .worktree/[repo]-[worktree-name]

# 3. Delete merged branch (if applicable)
git branch -d [branch-name]

# 4. Prune any orphaned worktrees
git worktree prune
```

**Parallel Claude Code Sessions:**
Each worktree can run independent Claude Code sessions:

- **Main repo**: Primary development and coordination
- **Feature worktrees**: Isolated feature development
- **Bug fix worktrees**: Safe bug fixing without main branch conflicts
- **Experiment worktrees**: Testing without affecting main environment

**Key advantages:**

- **Complete file isolation** (no editing conflicts possible)
- **Independent Git branches** (no merge conflicts during development)
- **Separate Claude Code contexts** (focused conversations per task)
- **Trust confirmation avoided** (all within trusted project directory)

**Best Practices:**

1. **Naming Convention**: Use repository prefix + descriptive names matching branch names
2. **Isolation**: Each worktree operates independently for builds/tests
3. **Testing**: Test changes in worktrees before merging
4. **Cleanup**: Always clean up completed worktrees to avoid clutter
5. **Coordination**: Use main repo for git operations (fetch, push, etc.)
6. **Claude Code**: Run separate Claude Code instances in each worktree for parallel development

### Commit Messages

Follow Conventional Commits format (always in English):

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting, missing semi-colons, etc
- `refactor:` for code changes that neither fixes a bug nor adds a feature
- `perf:` for performance improvements
- `test:` for adding missing tests
- `chore:` for updating build tasks, package manager configs, etc

### Staging and Commits

- Multiple files can be staged in a single `git add` command (e.g., `git add file1.txt file2.txt`)
- Dotfiles (files starting with .) can be added individually (e.g., `git add .gitignore .env.example`)

### Pull Request Management

**Creating Pull Requests:**

- Use `gh pr create --draft` command to create draft PRs by default (unless user specifies otherwise)
- Create focused PRs with clear titles following conventional commit format
- Keep PR body concise and descriptive
- No "Test plan" sections unless specifically requested
- PR title and body should follow LanguageSettings
- Use `gh pr ready [number]` to mark draft PR as ready for review

**Checking PR Status:**

- When unsure if PR exists, check first with `gh pr list --head [branch-name]` or `gh pr status`
- If PR doesn't exist, create new PR with `gh pr create --draft`
- If PR exists, view current details with `gh pr view [number]` before editing

**Editing Pull Requests:**

- Review existing PR content with `gh pr view [number]` to understand current context
- Use `gh pr edit [number] --title "new title"` for title-only changes
- Use `gh pr edit [number] --body "new body"` for body-only changes
- Always preserve important context when editing PR descriptions

**Reviewing Pull Requests:**

- Use `gh pr view [number]` to display PR details and status
- Use `gh pr diff [number]` to review code changes
- Use `gh pr checks [number]` to verify CI/CD status
- Use `gh pr list` to see all open PRs in repository

**PR Status Monitoring:**

- Check PR status before merging with `gh pr checks`
- Review CI/CD results and resolve any failures
- Ensure all required reviews are completed

## Git Operations Rules

### Sequential Execution Policy
When performing Git operations, execute commands one at a time to ensure proper error handling and status verification:

**Allowed to batch in parallel:**
- `git add file1.txt file2.txt file3.txt` (multiple files in single add command)
- Read-only operations like `git status`, `git diff`, `git log`

**Must execute sequentially:**
- All other Git operations (switch, commit, push, pull, merge, rebase, etc.)
- Each command should complete before executing the next
- Verify command success before proceeding

### Example Workflow
```bash
# ✅ Correct - Sequential execution
git switch main
git pull origin main
git switch -c feat/new-feature
git add file1.txt file2.txt  # Multiple files OK in single add
git commit -m "message"
git push -u origin feat/new-feature

# ❌ Incorrect - Parallel execution
git switch main && git pull origin main && git switch -c feat/new-feature
```

### Rationale
- Prevents race conditions and state conflicts
- Enables proper error handling at each step
- Ensures repository state is consistent between operations
- Allows for user intervention if issues occur
