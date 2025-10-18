{ config, pkgs, lib, ... }:

let
  utils = import ../utils { inherit config pkgs lib; };

  settings = {
    vim_mode = true;
    ui_font_size = 16;
    buffer_font_size = 16;
    theme = {
      mode = "system";
      light = "One Light";
      dark = "One Dark";
    };
  };

  keymap = [
    {
      context = "Workspace";
      bindings = {};
    }
    {
      context = "Editor && vim_mode == insert";
      bindings = {};
    }
    {
      bindings = {
        "ctrl-j" = null;
      };
    }
    {
      context = "Terminal";
      bindings = {
        "ctrl-j" = null;
      };
    }
  ];

  windowsZedDir = "/mnt/c/Users/${config.home.username}/AppData/Roaming/Zed";
in
{
  config = {
    # WSL/Linux: Merge settings to ~/.config/zed
    home.activation.zedSettings = utils.mergeJson {
      targetDir = "${config.home.homeDirectory}/.config/zed";
      settingsFile = "settings.json";
      overrides = settings;
    };

    # WSL/Linux: Replace keymap (array format cannot be merged)
    home.activation.zedKeymap = utils.mergeJson {
      targetDir = "${config.home.homeDirectory}/.config/zed";
      settingsFile = "keymap.json";
      overrides = keymap;
      replace = true;  # keymap.json is an array, not an object
    };

    # Windows: Merge settings if directory exists (WSL only)
    home.activation.zedSettingsWindows = utils.mergeJson {
      targetDir = windowsZedDir;
      settingsFile = "settings.json";
      overrides = settings;
      skipIfMissing = true;
    };

    # Windows: Replace keymap if directory exists (WSL only)
    home.activation.zedKeymapWindows = utils.mergeJson {
      targetDir = windowsZedDir;
      settingsFile = "keymap.json";
      overrides = keymap;
      skipIfMissing = true;
      replace = true;  # keymap.json is an array, not an object
    };
  };
}
