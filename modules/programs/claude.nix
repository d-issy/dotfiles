{
  config,
  lib,
  dotfiles,
  ...
}:
let
  settings = lib.importJSON (dotfiles.files + "/claude/settings.json");
  claudeFilesFiltered = builtins.filterSource (
    path: _type: !(lib.hasSuffix "settings.json" (baseNameOf path))
  ) (dotfiles.files + "/claude");
in
{
  config = {
    home = {
      shellAliases.cld = "claude";

      file.".claude" = {
        source = claudeFilesFiltered;
        recursive = true;
      };

      activation.claudeSettings = lib.helpers.json.mergeJson {
        targetDir = "${config.home.homeDirectory}/.claude";
        settingsFile = "settings.json";
        overrides = settings;
      };
    };
  };
}
