{ pkgs }:

let
  rustApp = import ./rust-app.nix { inherit pkgs; };
in
rec {
  agent-sessions = rustApp {
    pname = "agent-sessions";
    description = "Watch Claude Code and Codex sessions live";
    mainProgram = "agent-session";
  };

  claude-statusline = rustApp {
    pname = "claude-statusline";
    description = "Claude Code status line";
  };

  command-library = rustApp {
    pname = "command-library";
    description = "Pick a command from the command library with fzf";
  };

  git-autocommit = rustApp {
    pname = "git-autocommit";
    description = "AI-powered commit message generator using Pi CLI";
    mainProgram = "git-auto-commit";
  };

  herdr-subagents = rustApp {
    pname = "herdr-subagents";
    description = "Herdr subagent layout manager";
  };

  herdr-switcher = rustApp {
    pname = "herdr-switcher";
    description = "Select Herdr workspaces and repositories";
    nativeCheckInputs = [ pkgs.bash ];
  };

  wrapHerdrSwitcher = import ./herdr-switcher/wrap.nix {
    inherit pkgs;
    unwrapped = herdr-switcher;
  };

  tmux-notice = rustApp {
    pname = "tmux-notice";
    description = "tmux pane notice helper and status commands";
  };

  wrapTmuxNotice = import ./tmux-notice/wrap.nix {
    inherit pkgs;
    unwrapped = tmux-notice;
  };

  worktree = rustApp {
    pname = "worktree";
    description = "Personal git worktree helper";
    nativeCheckInputs = [ pkgs.git ];
  };
}
