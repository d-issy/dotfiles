{ pkgs, ... }:

let
  colors = {
    paneBorder = "#494d64";
    text = "#cad3f5";
    muted = "#8087a2";
    accent = "#ffb86c";
  };
in
{
  config.dot.programs.tmux = {
    enable = true;

    terminal = "tmux-256color";
    shell = "${pkgs.zsh}/bin/zsh";
    defaultCommand = "${pkgs.nushell}/bin/nu";

    baseIndex = 1;
    historyLimit = 9999999;
    keyMode = "vi";
    mouse = true;
    prefix = "C-q";

    plugins = {
      sensible.enable = true;
      resurrect.enable = true;
      catppuccin = {
        enable = true;
        flavor = "macchiato";
      };
    };

    keyBindings = {
      paneNavigationAndResize.enable = true;
      paneResize = {
        amount = 5;
        repeatable = true;
      };
      popups = {
        sessionSelector.enable = true;
        navi.enable = true;
      };
      sessionNavigation.enable = true;
      windowRename.enable = true;
      split.enable = true;
      copyModeVi.enable = true;
    };

    status = {
      position = "top";
      paneForegroundCommand.enable = true;
      windowNotice.enable = true;
      sessionList = {
        enable = true;
        colors = {
          active = colors.text;
          inactive = colors.muted;
          noticeBright = colors.text;
          noticeDim = colors.muted;
        };
      };
    };

    terminalFeatures = {
      xterm-256color = [
        "bpaste"
        "ccolour"
        "clipboard"
        "cstyle"
        "focus"
        "RGB"
        "sixel"
        "title"
      ];
      xterm-ghostty = [
        "256"
        "bpaste"
        "ccolour"
        "clipboard"
        "hyperlinks"
        "cstyle"
        "extkeys"
        "focus"
        "ignorefkeys"
        "margins"
        "mouse"
        "osc7"
        "overline"
        "rectfill"
        "RGB"
        "sixel"
        "strikethrough"
        "sync"
        "title"
        "usstyle"
        "progressbar"
      ];
    };

    extendedKeys.enable = true;
    passthrough.enable = true;

    terminalTitle = {
      enable = true;
      format = "#T";
    };

    paneBorder = {
      enable = true;
      indicators = "off";
      lines = "single";
      style = "fg=${colors.paneBorder}";
      activeStyle = "fg=${colors.accent}";
      autoHideSinglePane.enable = true;
      title = {
        enable = true;
        position = "top";
        activeStyle = "fg=${colors.accent}";
        inactiveStyle = "fg=${colors.muted}";
      };
    };

    bell.disable = true;
    renumberWindows.enable = true;
    automaticRename = {
      enable = true;
      format = "Window";
    };

    sessionSelector = {
      enable = true;
      commandName = "tm";
    };
  };
}
