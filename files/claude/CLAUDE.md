# Global Claude Code Instructions

## Language Settings
- Always respond in the same language as the user's message
- If the user writes in Japanese, respond in Japanese
- If the user writes in English, respond in English
- Code comments and documentation should follow the project's existing language conventions

## Git Workflow
- NEVER commit directly to main branch
- Always create feature branches for changes
- Use descriptive branch names (e.g., feat/claude-config, fix/typo-readme)
- ALWAYS check current branch with `git branch --show-current` before committing
- Create pull requests for all changes
- Use specific file paths with `git add` - NEVER use `git add .` or `git add -A`
- Multiple files can be staged in a single `git add` command (e.g., `git add file1.txt file2.txt`)

## Git Commit Messages
Follow Conventional Commits format (always in English):
- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting, missing semi-colons, etc
- `refactor:` for code changes that neither fixes a bug nor adds a feature
- `perf:` for performance improvements
- `test:` for adding missing tests
- `chore:` for updating build tasks, package manager configs, etc

## Pull Request Guidelines
- Create focused PRs with clear titles
- Keep PR body concise and descriptive
- No "Test plan" sections unless specifically requested
- PR title and body should follow LanguageSettings.

## General Development
- Always check existing code patterns before implementing
- Run linters and tests before committing
- Follow the project's existing code style

## Tool Usage
- ALWAYS prefer Claude Code dedicated tools over Bash commands
- Use LS tool instead of Bash(ls:*)
- Use Glob tool instead of Bash(find:*) for file pattern matching
- Use Grep tool instead of Bash(grep:*) for content searching
- Use Read tool instead of Bash(cat:*/head:*/tail:*)
- Use Task tool for complex multi-step searches
- Only use Bash for rg (ripgrep) when Grep tool is insufficient
- REASON: Dedicated tools are safer (respect .gitignore), more powerful, and prevent secrets exposure