{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.herdr;
  tomlFormat = pkgs.formats.toml { };
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;

  repoSwitcherTargets = pkgs.writeShellApplication {
    name = "herdr-repo-switcher-targets";
    runtimeInputs = [
      pkgs.coreutils
      cfg.repoSwitcher.ghqPackage
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

  repoSwitcherCommand = "${repoSwitcherTargets}/bin/herdr-repo-switcher-targets";

  workspaceSwitcherTargets = pkgs.writeShellApplication {
    name = "herdr-workspace-switcher-targets";
    runtimeInputs = [
      pkgs.jq
      cfg.package
    ];
    text = ''
      "''${HERDR_BIN_PATH:-${cfg.package}/bin/herdr}" workspace list 2>/dev/null \
        | jq -r '.result.workspaces[]? | ["workspace", .workspace_id, .label] | @tsv' \
        || true
    '';
  };

  workspaceSwitcherCommand = "${workspaceSwitcherTargets}/bin/herdr-workspace-switcher-targets";

  repoSwitcher = pkgs.writeShellApplication {
    name = cfg.repoSwitcher.commandName;
    runtimeInputs = [
      pkgs.coreutils
      pkgs.jq
      cfg.package
      cfg.repoSwitcher.ghqPackage
    ];
    text = ''
      set -u

      herdr="''${HERDR_BIN_PATH:-${cfg.package}/bin/herdr}"

      if [ -n "$(${workspaceSwitcherCommand})" ]; then
        selected=$(
          ${workspaceSwitcherCommand} \
            | ${fuzzyFinderCommand} \
              --delimiter='\t' \
              --with-nth=3 \
              --header='Ctrl-R: repos/orgs' \
              --bind="ctrl-r:reload(${repoSwitcherCommand})+change-header(Repos/orgs)"
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
          value="$(realpath "$value")"
          workspaces="$("$herdr" workspace list)"
          workspace_id="$(printf '%s' "$workspaces" | jq -r --arg path "$value" '
            [.result.workspaces[] | select(.tokens.dot_repo_path == $path or .worktree.checkout_path == $path) | .workspace_id][0] // empty
          ')"
          if [ -z "$workspace_id" ]; then
            # Adopt an existing workspace only when its pane cwd matches the repo.
            while IFS= read -r candidate; do
              if "$herdr" pane list --workspace "$candidate" \
                | jq -e --arg path "$value" 'any(.result.panes[]?; .cwd == $path)' >/dev/null; then
                workspace_id="$candidate"
                break
              fi
            done < <(printf '%s' "$workspaces" | jq -r '.result.workspaces[] | select(.tokens.dot_repo_path == null) | .workspace_id')
          fi
          if [ -z "$workspace_id" ]; then
            created="$("$herdr" workspace create --cwd "$value" --label "$label" --focus)"
            workspace_id="$(printf '%s' "$created" | jq -er '.result.workspace.workspace_id')"
          fi
          "$herdr" workspace report-metadata "$workspace_id" --source dotfiles --token "dot_repo_path=$value" >/dev/null
          "$herdr" workspace focus "$workspace_id"
          ;;
      esac
    '';
  };

  repoSwitcherKeybind = {
    key = cfg.repoSwitcher.key;
    type = "pane";
    command = "${repoSwitcher}/bin/${cfg.repoSwitcher.commandName}";
    description = "open repo workspace";
  };

  settings = lib.recursiveUpdate cfg.settings {
    keys.command =
      (lib.attrByPath [ "keys" "command" ] [ ] cfg.settings)
      ++ lib.optional cfg.repoSwitcher.enable repoSwitcherKeybind;
  };
in
{
  options.dot.programs.herdr = {
    enable = lib.mkEnableOption "herdr";

    package = lib.mkPackageOption pkgs "herdr" { };

    settings = lib.mkOption {
      inherit (tomlFormat) type;
      default = { };
      description = "Settings written to herdr/config.toml.";
    };

    repoSwitcher = {
      enable = lib.mkEnableOption "prefix key repo/workspace switcher";

      key = lib.mkOption {
        type = lib.types.str;
        default = "prefix+s";
        description = "Herdr keybinding for the repo/workspace switcher.";
      };

      commandName = lib.mkOption {
        type = lib.types.str;
        default = "herdr-repo-switcher";
        description = "Command name for selecting Herdr workspaces or ghq repositories.";
      };

      ghqPackage = lib.mkOption {
        type = lib.types.package;
        default = config.dot.programs.ghq.package;
        defaultText = lib.literalExpression "config.dot.programs.ghq.package";
        description = "ghq package used by the repo switcher.";
      };

      includeParentDirectories = lib.mkOption {
        type = lib.types.bool;
        default = false;
        description = "Whether the repo switcher includes one-level-up parent directories of ghq repositories.";
      };

      package = lib.mkOption {
        type = lib.types.package;
        readOnly = true;
        default = repoSwitcher;
        description = "Generated Herdr repo switcher package.";
      };
    };
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ] ++ lib.optional cfg.repoSwitcher.enable cfg.repoSwitcher.package;

    xdg.configFile."herdr/config.toml" = lib.mkIf (settings != { }) {
      source = tomlFormat.generate "herdr-config" settings;
    };
  };
}
