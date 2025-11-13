{ config, pkgs, lib, ... }:
let
  utils = import ../utils { inherit config pkgs lib; };

  opencodeFilesFiltered = builtins.filterSource
    (path: type:
      !(lib.hasSuffix "opencode.json" (baseNameOf path))
    )
    ../files/opencode;

  settings = {
    "$schema" = "https://opencode.ai/config.json";
    theme = "catppuccin";
    autoupdate = true;
    keybinds = {
      app_exit = "ctrl+c,ctrl+d,<leader>q";
      editor_open = "ctrl+o,<leader>e";
    };
    permission = {
      webfetch = "ask";
      bash = {
        "*" = "ask";
        "git branch --show-current" = "allow";
        "git diff*" = "allow";
        "git grep *" = "allow";
        "git log*" = "allow";
        "git ls-files*" = "allow";
        "git show*" = "allow";
        "git status*" = "allow";
        "git switch *" = "allow";
        "gh pr checks*" = "allow";
        "gh pr diff*" = "allow";
        "gh pr list*" = "allow";
        "gh pr show*" = "allow";
        "gh pr status*" = "allow";
        "gh pr view*" = "allow";
        "rg *" = "allow";
        "ls*" = "allow";
        "touch *" = "allow";
        "cat" = "ask";
        "head -*" = "allow";
        "tail -*" = "allow";
        "sort*" = "allow";
        "wc *" = "allow";
        "find*" = "deny";
        "grep*" = "deny";
        "sudo*" = "deny";
      };
    };
    agent = {
      build = {
        temperature = 0.3;
        permission = {
          bash = {
            "mkdir -p *" = "allow";
            "git mv *" = "allow";
            "git rm *" = "allow";
          };
        };
      };
      plan = {
        temperature = 0.1;
        tools = {
          edit = false;
          write = false;
          patch = false;
        };
      };
    };
  };
in
{
  config = {
    xdg.configFile."opencode" = {
      source = opencodeFilesFiltered;
      recursive = true;
    };

    home.activation.opencodeSettings = utils.mergeJson {
      targetDir = "${config.xdg.configHome}/opencode";
      settingsFile = "opencode.json";
      overrides = settings;
    };
  };
}
