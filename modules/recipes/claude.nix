{
  config,
  lib,
  dot,
  ...
}:
let
  settings = lib.importJSON (dot.files + "/claude/settings.json");
  claudeDir = dot.files + "/claude";
  claudeFilesFiltered = builtins.filterSource (
    path: _type: path != toString (claudeDir + "/settings.json")
  ) claudeDir;
in
{
  config = {
    home = {
      shellAliases = {
        cld = "claude";
        cla = "claude --permission-mode auto";
        clc = "claude --continue";
        clr = "claude --resume";
      };

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
