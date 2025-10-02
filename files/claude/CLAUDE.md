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
- Follow the project's existing code style and commenting conventions
- Keep code comments minimal - don't add comments for things obvious from reading the code
- Minimize output verbosity: Explain what you'll do at the task/TODO level, but avoid narrating every file operation (Read, Edit, Write)
- NEVER commit or push automatically - always wait for explicit user instruction
- NEVER use `find` command - use `Glob` tool instead (security: find -exec allows arbitrary command execution)
- NEVER use `grep` command - use `Grep` tool or `rg` instead (security: grep searches gitignored files)

## Git Workflow

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

### Pull Request Management

- Create PRs: Use `gh pr create --draft` by default, follow conventional commit format for titles
- Check status: Use `gh pr status` to check if PR exists
- Unless user specifies PR number, use `gh pr` commands without number to target current branch's PR
- Review with `gh pr view` before editing, use `--title` or `--body` flags for edits
- Use `gh pr diff` for changes, `gh pr checks` for CI/CD status
- PR title and body should follow Language Settings

## Git Operations Rules

### Sequential Execution Policy

Execute Git operations one at a time for proper error handling and status verification:

- **Allowed in parallel**: `git add` (multiple files), read-only operations (`git status`, `git diff`, `git log`)
- **Must execute sequentially**: All other Git operations (switch, commit, push, pull, merge, rebase, etc.)
