{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.tm;
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;

  repoSwitcherTargets = pkgs.writeShellApplication {
    name = "tm-repo-switcher-targets";
    runtimeInputs = [
      pkgs.coreutils
      cfg.ghqPackage
    ];
    text = ''
      ghq list -p 2>/dev/null || true

      ${lib.optionalString cfg.repoSwitcher.includeParentDirectories ''
        ghq list -p 2>/dev/null | while IFS= read -r repo; do
          dirname "$repo"
        done || true
      ''}
    '';
  };

  repoSwitcherCommand = "${repoSwitcherTargets}/bin/tm-repo-switcher-targets | sort -u";

  tm = pkgs.writeShellApplication {
    name = cfg.commandName;
    runtimeInputs = [
      pkgs.coreutils
      cfg.ghqPackage
      cfg.tmuxPackage
    ];
    text = ''
      set -u

      if tmux has-session 2>/dev/null; then
        target=$(
          tmux list-sessions -F '#S' 2>/dev/null \
            | ${fuzzyFinderCommand} \
              --header='Ctrl-C: repos/orgs  Ctrl-D: delete' \
              --bind="ctrl-c:reload(${repoSwitcherCommand})+change-header(Repos/orgs)" \
              --bind="ctrl-d:execute(tmux kill-session -t {1})+reload(tmux list-sessions -F '#S' 2>/dev/null || true)"
        )
      else
        target=$(
          ${repoSwitcherCommand} \
            | ${fuzzyFinderCommand} --header='Repos/orgs'
        )
      fi

      if [ -z "$target" ]; then
        exit 0
      fi

      if ! tmux has-session -t "$target" 2>/dev/null; then
        session_name=$(basename "$target")
        if tmux has-session -t "$session_name" 2>/dev/null; then
          target="$session_name"
        else
          tmux new-session -s "$session_name" -c "$target" -d
          target="$session_name"
        fi
      fi

      if [ -z "''${TMUX-}" ]; then
        tmux attach-session -t "$target"
      else
        tmux switch-client -t "$target"
      fi
    '';
  };
in
{
  options.dot.programs.scripts.tm = {
    enable = lib.mkEnableOption "personal tm tmux session selector command";

    commandName = lib.mkOption {
      type = lib.types.str;
      default = "tm";
      description = "Command name for selecting tmux sessions.";
    };

    tmuxPackage = lib.mkOption {
      type = lib.types.package;
      default = config.dot.programs.tmux.package;
      defaultText = lib.literalExpression "config.dot.programs.tmux.package";
      description = "tmux package used by tm.";
    };

    ghqPackage = lib.mkOption {
      type = lib.types.package;
      default = config.dot.programs.ghq.package;
      defaultText = lib.literalExpression "config.dot.programs.ghq.package";
      description = "ghq package used by tm.";
    };

    repoSwitcher.includeParentDirectories = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether the repo switcher includes one-level-up parent directories of ghq repositories.";
    };

    package = lib.mkOption {
      type = lib.types.package;
      readOnly = true;
      default = tm;
      description = "Generated tm package.";
    };
  };

  config = lib.mkIf (config.dot.programs.scripts.enable && cfg.enable) {
    home.packages = [ cfg.package ];
  };
}
