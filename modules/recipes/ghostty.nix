_:

{
  programs.ghostty = {
    enable = true;
    package = null; # not use in nixpkgs, install manually
    systemd.enable = false; # required when package is null
    settings = {
      # UI
      theme = "Catppuccin Macchiato";
      "font-size" = 14;

      "font-family" = [
        "0xProto"
        "UDEV Gothic 35"
        "Hack Nerd Font Mono"
        "Hiragino Kaku Gothic ProN"
      ];

      "font-feature" = [
        "-dlig"
        "calt"
        "clig"
        "liga"
      ];

      "window-padding-x" = 0;
      "window-padding-y" = 0;
      "window-padding-balance" = false;

      "mouse-hide-while-typing" = true;
      "resize-overlay" = "never";
      "link-url" = true;

      # macOS specific
      "macos-option-as-alt" = "left";
      "macos-titlebar-style" = "tabs";

      # keybind
      keybind = [
        "ctrl+j=ignore"
        "shift+enter=text:\\x1b\\r"
        "ctrl+shift+r=reload_config"
      ];
    };
  };
}
