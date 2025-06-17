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
- NEVER commit directly to main branch - always use worktrees for all changes
- When asked to commit changes, create worktree first, then commit in the worktree
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

## Tool Usage
- When working in a repository, prioritize project-specific CLAUDE.md instructions over these global guidelines
- ALWAYS prefer Claude Code dedicated tools over Bash commands
- ALWAYS prefer MultiEdit over Edit when making multiple changes to the same file
- Use LS tool instead of Bash(ls:*)
- Use Glob tool instead of Bash(find:*) for file pattern matching
- Use Grep tool instead of Bash(grep:*) for content searching
- Use Read tool instead of Bash(cat:*), Bash(head:*), Bash(tail:*)
- Use Task tool for complex multi-step searches
- For file deletion in Git repositories, use `git rm` instead of `rm`
- Only use Bash for rg (ripgrep) when Grep tool is insufficient
- REASON: Dedicated tools are safer (respect .gitignore), more powerful, and prevent secrets exposure

## Git Workflow with Worktree Development

### Worktree Development Workflow (Recommended)

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
- Use specific file paths with `git add` - NEVER use `git add .` or `git add -A`
- Multiple files can be staged in a single `git add` command (e.g., `git add file1.txt file2.txt`)
- Dotfiles (files starting with .) can be added individually (e.g., `git add .gitignore .env.example`)
- EXCEPTION: `git add .` means "add current directory", which stages everything - this is forbidden
- ALLOWED: `git add .filename` means "add the specific dotfile" - this is perfectly fine

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
