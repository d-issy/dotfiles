{ pkgs, ... }:

{
  config.dot.programs.tmux = {
    enable = true;

    terminal = "tmux-256color";
    shell = "${pkgs.zsh}/bin/zsh";
    defaultCommand = "${pkgs.nushell}/bin/nu";

    baseIndex = 1;
    customPaneNavigationAndResize = true;
    historyLimit = 9999999;
    keyMode = "vi";
    mouse = true;
    prefix = "C-q";
    resizeAmount = 5;

    plugins = {
      sensible.enable = true;
      resurrect.enable = true;
    };

    catppuccin = {
      enable = true;
      flavor = "macchiato";
    };

    status = {
      paneForegroundCommand.enable = true;
      windowNotice.enable = true;
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

    popupBindings = {
      sessionSelector.enable = true;
      navi.enable = true;
    };
    splitBindings.enable = true;
    viCopyMode.enable = true;

    paneBorder = {
      enable = true;
      indicators = "off";
      lines = "heavy";
      status = "off";
      activeStyle = "fg=#ffb86c";
      title = {
        enable = true;
        format = " #P#{?#{||:#{==:#{pane_title},π},#{==:#{pane_title}, }}, #{pane_title}, #{pane_title}} ";
      };
      autoHideSinglePane.enable = true;
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
      defaultSessionName = "main";
      zshIntegration.enable = true;
      nushellIntegration.enable = true;
    };
  };
}
