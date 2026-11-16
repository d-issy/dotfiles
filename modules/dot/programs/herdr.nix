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

  repoSwitcher = pkgs.dotApps.wrapHerdrSwitcher {
    name = cfg.repoSwitcher.commandName;
    herdr = cfg.package;
    ghq = cfg.repoSwitcher.ghqPackage;
    fuzzyFinder = fuzzyFinderCommand;
    inherit (cfg.repoSwitcher) includeParentDirectories;
  };

  repoSwitcherKeybind = {
    key = cfg.repoSwitcher.key;
    type = "pane";
    command = "${config.home.profileDirectory}/bin/${cfg.repoSwitcher.commandName}";
    description = "open repo workspace";
  };

  settings =
    if cfg.repoSwitcher.enable then
      lib.recursiveUpdate cfg.settings {
        keys.command = (lib.attrByPath [ "keys" "command" ] [ ] cfg.settings) ++ [ repoSwitcherKeybind ];
      }
    else
      cfg.settings;
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
