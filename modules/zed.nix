{ config, pkgs, lib, ... }:

let
  utils = import ../utils { inherit config pkgs lib; };

  settings = {
    # Keymap
    base_keymap = "VSCode";
    vim_mode = true;

    # Font
    ui_font_size = 16;
    buffer_font_size = 16;

    # Theme
    theme = {
      mode = "system";
      light = "One Light";
      dark = "One Dark";
    };

    # Startup
    restore_on_startup = "last_workspace";
  };

  keymap = [
    # Workspace context
    {
      context = "Workspace";
      bindings = {};
    }

    # Vim normal mode
    {
      context = "vim_mode == normal";
      bindings = {
        # Navigation
        "space e" = "pane::RevealInProjectPanel";  # Reveal current file in project panel

        # Tab navigation
        "shift-h" = "pane::ActivatePreviousItem";  # Previous tab
        "shift-l" = "pane::ActivateNextItem";  # Next tab
        "space b o" = "pane::CloseOtherItems";  # Close all other tabs

        # Git
        "space g s" = "git_panel::ToggleFocus";  # Toggle Git panel focus
        "] h" = "editor::GoToHunk";  # Next git hunk
        "[ h" = "editor::GoToPreviousHunk";  # Previous git hunk
      };
    }

    # Vim insert mode
    {
      context = "vim_mode == insert";
      bindings = {
        # Paste
        "ctrl-v" = "editor::Paste";
      };
    }

    # Global context
    {
      bindings = {
        "ctrl-j" = null;  # Disable ctrl-j globally
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
