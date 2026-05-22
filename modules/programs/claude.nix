{
  config,
  lib,
  dot,
  ...
}:
let
  settings = lib.importJSON (dot.files + "/claude/settings.json");
  claudeFilesFiltered = builtins.filterSource (
    path: _type: !(lib.hasSuffix "settings.json" (baseNameOf path))
  ) (dot.files + "/claude");
in
{
  config = {
    home = {
      shellAliases.cld = "claude";

      file.".claude" = {
        source = claudeFilesFiltered;
        recursive = true;
      };

      activation.claudeSettings = dot.mergeJson {
        targetDir = "${config.home.homeDirectory}/.claude";
        settingsFile = "settings.json";
        overrides = settings;
      };
    };
  };
}
