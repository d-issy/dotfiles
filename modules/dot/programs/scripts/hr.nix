{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.hr;
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;

  repoSwitcherTargets = pkgs.writeShellApplication {
    name = "hr-repo-switcher-targets";
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
        [ -n "$repo" ] || continue
        printf 'repo\t%s\t%s\t%s\n' "$repo" "$repo" "$(basename "$repo")"
      done
    '';
  };

  repoSwitcherCommand = "${repoSwitcherTargets}/bin/hr-repo-switcher-targets";

  workspaceSwitcherTargets = pkgs.writeShellApplication {
    name = "hr-workspace-switcher-targets";
    runtimeInputs = [
      pkgs.jq
      cfg.herdrPackage
    ];
    text = ''
      "''${HERDR_BIN_PATH:-${cfg.herdrPackage}/bin/herdr}" workspace list 2>/dev/null \
        | jq -r '.result.workspaces[]? | ["workspace", .workspace_id, .label] | @tsv' \
        || true
    '';
  };

  workspaceSwitcherCommand = "${workspaceSwitcherTargets}/bin/hr-workspace-switcher-targets";

  hr = pkgs.writeShellApplication {
    name = cfg.commandName;
    runtimeInputs = [
      pkgs.coreutils
      pkgs.jq
      cfg.herdrPackage
      cfg.ghqPackage
    ];
    text = ''
      set -u

      herdr="''${HERDR_BIN_PATH:-${cfg.herdrPackage}/bin/herdr}"

      if "$herdr" status server --json 2>/dev/null | jq -e '.running == true and .compatible == true' >/dev/null; then
        if [ -n "$(${workspaceSwitcherCommand})" ]; then
          selected=$(
            ${workspaceSwitcherCommand} \
              | ${fuzzyFinderCommand} \
                --delimiter='\t' \
                --with-nth=3 \
                --header='Ctrl-C: repos/orgs' \
                --bind="ctrl-c:reload(${repoSwitcherCommand})+change-header(Repos/orgs)"
          )
        else
          selected=$(
            ${repoSwitcherCommand} \
              | ${fuzzyFinderCommand} \
                --delimiter='\t' \
                --with-nth=3 \
                --header='Repos/orgs'
          )
        fi

        if [ -z "$selected" ]; then
          exit 0
        fi

        kind="$(printf '%s' "$selected" | cut -f 1)"
        value="$(printf '%s' "$selected" | cut -f 2)"
        case "$kind" in
          workspace)
            [ -n "$value" ] || exit 0
            "$herdr" workspace focus "$value"
            ;;
          repo)
            [ -n "$value" ] && [ -d "$value" ] || exit 0
            label="$(printf '%s' "$selected" | cut -f 4-)"
            [ -n "$label" ] || label="$(basename "$value")"
            workspace_id="$($herdr workspace list | jq -r --arg label "$label" '.result.workspaces[] | select(.label == $label) | .workspace_id' | head -n 1)"
            if [ -n "$workspace_id" ]; then
              "$herdr" workspace focus "$workspace_id"
            else
              "$herdr" workspace create --cwd "$value" --label "$label" --focus
            fi
            ;;
        esac

        exec "$herdr"
      fi

      selected=$(
        ${repoSwitcherCommand} \
          | ${fuzzyFinderCommand} \
            --delimiter='\t' \
            --with-nth=3 \
            --header='Repos/orgs'
      )

      if [ -z "$selected" ]; then
        exit 0
      fi

      kind="$(printf '%s' "$selected" | cut -f 1)"
      value="$(printf '%s' "$selected" | cut -f 2)"

      [ "$kind" = repo ] || exit 0
      [ -n "$value" ] && [ -d "$value" ] || exit 0

      cd "$value"
      exec "$herdr"
    '';
  };
in
{
  options.dot.programs.scripts.hr = {
    enable = lib.mkEnableOption "personal hr Herdr workspace selector command";

    commandName = lib.mkOption {
      type = lib.types.str;
      default = "hr";
      description = "Command name for selecting Herdr workspaces/repositories and launching Herdr.";
    };

    herdrPackage = lib.mkOption {
      type = lib.types.package;
      default = config.dot.programs.herdr.package;
      defaultText = lib.literalExpression "config.dot.programs.herdr.package";
      description = "Herdr package used by hr.";
    };

    ghqPackage = lib.mkOption {
      type = lib.types.package;
      default = config.dot.programs.ghq.package;
      defaultText = lib.literalExpression "config.dot.programs.ghq.package";
      description = "ghq package used by hr.";
    };

    repoSwitcher.includeParentDirectories = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether the repo switcher includes one-level-up parent directories of ghq repositories.";
    };

    package = lib.mkOption {
      type = lib.types.package;
      readOnly = true;
      default = hr;
      description = "Generated hr package.";
    };
  };

  config = lib.mkIf (config.dot.programs.scripts.enable && cfg.enable) {
    home.packages = [ cfg.package ];
  };
}
