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
      {
        ghq list -p 2>/dev/null || true
        ${lib.optionalString cfg.repoSwitcher.includeParentDirectories ''
          ghq list -p 2>/dev/null | while IFS= read -r repo; do
            dirname "$repo"
          done || true
        ''}
      } | sort -u | while IFS= read -r repo; do
        printf 'repo\t%s\t%s\n' "$repo" "$repo"
      done
    '';
  };

  repoSwitcherCommand = "${repoSwitcherTargets}/bin/tm-repo-switcher-targets | sort -u";

  sessionSwitcherTargets = pkgs.writeShellApplication {
    name = "tm-session-switcher-targets";
    runtimeInputs = [ cfg.tmuxPackage ];
    text = ''
      tmux list-sessions -F '#{session_id} #{session_name}' 2>/dev/null | while IFS=' ' read -r id name; do
        printf 'session\t%s\t%s\n' "$id" "$name"
      done || true
    '';
  };

  sessionSwitcherCommand = "${sessionSwitcherTargets}/bin/tm-session-switcher-targets";

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
        selected=$(
          ${sessionSwitcherCommand} \
            | ${fuzzyFinderCommand} \
              --delimiter='\t' --with-nth=3 \
              --header='Ctrl-R: repos/orgs  Ctrl-D: delete' \
              --bind="ctrl-r:reload(${repoSwitcherCommand})+change-header(Repos/orgs)" \
              --bind="ctrl-d:execute(tmux kill-session -t {2})+reload(${sessionSwitcherCommand})"
        )
      else
        selected=$(
          ${repoSwitcherCommand} \
            | ${fuzzyFinderCommand} --delimiter='\t' --with-nth=3 --header='Repos/orgs'
        )
      fi

      if [ -z "$selected" ]; then
        exit 0
      fi

      kind="$(printf '%s' "$selected" | cut -f 1)"
      target="$(printf '%s' "$selected" | cut -f 2)"
      if [ "$kind" = repo ]; then
        repo="$(realpath "$target")"
        target=
        printf -v format '%s\037%s\037%s' '#{session_id}' '#{@repo_path}' '#{session_path}'
        while IFS=$'\037' read -r id saved_path session_path; do
          path="''${saved_path:-$session_path}"
          [ -n "$path" ] || continue
          if [ "$(realpath "$path" 2>/dev/null || true)" = "$repo" ]; then
            target="$id"
            break
          fi
        done < <(tmux list-sessions -F "$format" 2>/dev/null || true)
        if [ -z "$target" ]; then
          base="$(basename "$repo" | tr '.:' '__')"
          session_name="$base"
          suffix="$(printf '%s' "$repo" | sha256sum | cut -c1-10)"
          index=0
          while tmux has-session -t "=$session_name" 2>/dev/null; do
            session_name="$base-$suffix"
            if [ "$index" -gt 0 ]; then
              session_name="$session_name-$index"
            fi
            index=$((index + 1))
          done
          target="$(tmux new-session -P -F '#{session_id}' -s "$session_name" -c "$repo" -d)"
        fi
        tmux set-option -t "$target" @repo_path "$repo"
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
