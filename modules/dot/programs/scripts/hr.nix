{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.hr;
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;

  hr = pkgs.dotApps.wrapHerdrSwitcher {
    name = cfg.commandName;
    herdr = cfg.herdrPackage;
    ghq = cfg.ghqPackage;
    fuzzyFinder = fuzzyFinderCommand;
    inherit (cfg.repoSwitcher) includeParentDirectories;
    attach = true;
  };
in
{
  options.dot.programs.scripts.hr = {
    enable = lib.mkEnableOption "personal hr Herdr space selector command";

    commandName = lib.mkOption {
      type = lib.types.str;
      default = "hr";
      description = "Command name for selecting Herdr spaces and repositories.";
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
