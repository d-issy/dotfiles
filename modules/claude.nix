{ config, pkgs, ... }: {
  config = {
    # Global CLAUDE.md for general development practices
    home.file.".claude/CLAUDE.md" = {
      text = ''
        # Global Claude Code Instructions

        **Important: Always respond in Japanese when working with code.**

        ## Git Commit Messages
        Follow Conventional Commits format:
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
        - PR title and body should use the language requested by the user (default to their language)

        ## General Development
        - Always check existing code patterns before implementing
        - Run linters and tests before committing
        - Follow the project's existing code style
      '';
    };

    home.file.".claude/settings.json" = {
      text = builtins.toJSON {
        permissions = {
          allow = [
            # Git safe operations
            "Bash(git status:*)"
            "Bash(git diff:*)"
            "Bash(git log:*)"
            "Bash(git show:*)"
            "Bash(git branch -a:*)"
            "Bash(git remote -v:*)"
            
            # Package managers (read-only)
            "Bash(npm list:*)"
            "Bash(npm outdated:*)"
            "Bash(yarn list:*)"
            "Bash(pip list:*)"
            "Bash(pip show:*)"
            "Bash(go list:*)"
            "Bash(cargo tree:*)"
            
            # Testing and linting (dry-run)
            "Bash(npm run lint:*)"
            "Bash(npm run test:*)"
            
            # Build tools (check only)
            "Bash(make -n:*)"
            "Bash(docker ps:*)"
            "Bash(docker images:*)"
            
            # GitHub CLI (read-only)
            "Bash(gh pr list:*)"
            "Bash(gh pr view:*)"
            "Bash(gh issue list:*)"
            "Bash(gh issue view:*)"
            "Bash(gh repo view:*)"
            
            # Documentation
            "WebFetch(domain:docs.anthropic.com)"
            "WebFetch(domain:github.com)"
            "WebFetch(domain:*.github.io)"
          ];
          deny = [];
        };
      };
    };
  };
}