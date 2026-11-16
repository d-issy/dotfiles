{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.tm;
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;

  configFile = (pkgs.formats.json { }).generate "tm.json" {
    tmux = lib.getExe cfg.tmuxPackage;
    ghq = lib.getExe cfg.ghqPackage;
    fuzzyFinder = fuzzyFinderCommand;
    inherit (cfg.repoSwitcher) includeParentDirectories;
  };

  tm = pkgs.writeShellScriptBin cfg.commandName ''
    exec ${lib.getExe pkgs.dotApps.tm-switcher} --config ${configFile} "$@"
  '';
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
