{
  config,
  lib,
  pkgs,
  dot,
  ...
}:
let
  claudeStatusline = import ../../apps/rust-app.nix { inherit pkgs; } {
    pname = "claude-statusline";
    description = "Claude Code status line";
  };
  settings = lib.importJSON (dot.files + "/claude/settings.json");
  claudeDir = dot.files + "/claude";
  claudeFilesFiltered = builtins.filterSource (
    path: _type: path != toString (claudeDir + "/settings.json")
  ) claudeDir;
in
{
  config = {
    home = {
      packages = [ claudeStatusline ];

      shellAliases = {
        cla = "claude --permission-mode auto";
        clc = "claude --continue";
        clf = "claude --model fable --permission-mode auto";
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
