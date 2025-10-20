{ config, pkgs, lib, ... }:
let
  utils = import ../utils { inherit config pkgs lib; };

  settings = lib.importJSON ../files/claude/settings.json;
  claudeFilesFiltered = builtins.filterSource
    (path: type:
      !(lib.hasSuffix "settings.json" (baseNameOf path))
    )
    ../files/claude;
in
{
  config = {
    home.file.".claude" = {
      source = claudeFilesFiltered;
      recursive = true;
    };

    home.activation.claudeSettings = utils.mergeJson {
      targetDir = "${config.home.homeDirectory}/.claude";
      settingsFile = "settings.json";
      overrides = settings;
    };
  };
}
