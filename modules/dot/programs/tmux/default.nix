{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.tmux;
  paneCommand = import ./pane-command.nix { inherit pkgs; };
  sessionSelector = import ./session-selector.nix { inherit config; };

  windowNotice = "#{?@window_notice, #{@window_notice},}";
  borderToggle = ''if -F "#{==:#{window_panes},1}" "setw pane-border-status off" "setw pane-border-status top"'';

  tmuxBoolean = value: if value then "on" else "off";

  mkTmuxSet =
    scope: name: value:
    "set${scope} ${name} ${value}";
  mkSetGlobal = mkTmuxSet " -g";
  mkSetWindowGlobal = mkTmuxSet "w -g";

  pluginPath = name: plugin: "${plugin}/share/tmux-plugins/${name}";

  runPlugin = name: plugin: ''
    run-shell ${pluginPath name plugin}/${name}.tmux
  '';

  mkTerminalFeature = terminal: features: ''
    set -as terminal-features ',${terminal}:${lib.concatStringsSep ":" features}'
  '';

  baseConfig = ''
    ${mkSetGlobal "default-terminal" ''"${cfg.terminal}"''}
    ${lib.optionalString (cfg.shell != null) (mkSetGlobal "default-shell" ''"${cfg.shell}"'')}
    ${lib.optionalString (cfg.defaultCommand != null) (
      mkSetGlobal "default-command" ''"${cfg.defaultCommand}"''
    )}
    ${mkSetGlobal "base-index" (toString cfg.baseIndex)}
    ${mkSetWindowGlobal "pane-base-index" (toString cfg.baseIndex)}
    ${mkSetGlobal "history-limit" (toString cfg.historyLimit)}
    ${mkSetGlobal "mouse" (tmuxBoolean cfg.mouse)}
    ${mkSetWindowGlobal "mode-keys" cfg.keyMode}
    unbind-key C-b
    ${mkSetGlobal "prefix" cfg.prefix}
    bind-key ${cfg.prefix} send-prefix
  '';

  terminalFeaturesConfig = lib.concatStrings (
    lib.mapAttrsToList mkTerminalFeature cfg.terminalFeatures
  );

  pluginConfig = lib.concatStringsSep "\n" [
    (lib.optionalString cfg.plugins.sensible.enable (runPlugin "sensible" pkgs.tmuxPlugins.sensible))
    (lib.optionalString cfg.plugins.resurrect.enable (runPlugin "resurrect" pkgs.tmuxPlugins.resurrect))
    (lib.optionalString cfg.catppuccin.enable ''
      set -g @catppuccin_flavor "${cfg.catppuccin.flavor}" # latte, frappe, macchiato, mocha
      set -g @catppuccin_status_background "none"
      set -g @catppuccin_window_status_style "none"
      set -g @catppuccin_pane_status_enabled "off"
      set -g @catppuccin_pane_border_status "off"
      source-file ${pluginPath "catppuccin" pkgs.tmuxPlugins.catppuccin}/catppuccin_tmux.conf
    '')
  ];

  statusLeftCommand =
    if cfg.status.paneForegroundCommand.enable then
      "#(${paneCommand.command} #{pane_tty})"
    else
      "#{pane_current_command}";

  windowNoticeText = lib.optionalString cfg.status.windowNotice.enable windowNotice;

  catppuccinStatusConfig = lib.optionalString cfg.catppuccin.enable ''
    set -g window-status-format " #I${windowNoticeText}#{?#{!=:#{window_name},Window},: #W,} "
    set -g window-status-style "bg=#{@thm_bg},fg=#{@thm_rosewater}"
    set -g window-status-last-style "bg=#{@thm_bg},fg=#{@thm_peach}"
    set -g window-status-activity-style "bg=#{@thm_red},fg=#{@thm_bg}"
    set -g window-status-bell-style "bg=#{@thm_red},fg=#{@thm_bg},bold"
    set -gF window-status-separator "#[bg=#{@thm_bg},fg=#{@thm_overlay_0}]│"
    set -g window-status-current-format " #I${windowNoticeText}#{?#{!=:#{window_name},Window},: #W,} "
    set -g window-status-current-style "bg=#{@thm_peach},fg=#{@thm_bg},bold"

    set -g  status-left-length 100
    set -g status-left ""
    set -ga status-left "#{?client_prefix,#{#[bg=#{@thm_red},fg=#{@thm_bg},bold]  #S },#{#[bg=#{@thm_bg},fg=#{@thm_green}]  #S }}"
    set -ga status-left "#[bg=#{@thm_bg},fg=#{@thm_maroon}]  ${statusLeftCommand} "

    set -g status-right-length 100
    set -g status-right ""
    set -ga status-right "#[bg=#{@thm_bg},fg=#{@thm_yellow}]#{?window_zoomed_flag,  zoom ,}"
    set -ga status-right "#[bg=#{@thm_bg},fg=#{@thm_blue}] 󰭦 %Y-%m-%d 󰅐 %H:%M "

    set -g status-justify "absolute-centre"
  '';

  customPaneNavigationAndResizeConfig = lib.optionalString cfg.customPaneNavigationAndResize ''
    bind-key h select-pane -L
    bind-key j select-pane -D
    bind-key k select-pane -U
    bind-key l select-pane -R
    bind-key H resize-pane -L ${toString cfg.resizeAmount}
    bind-key J resize-pane -D ${toString cfg.resizeAmount}
    bind-key K resize-pane -U ${toString cfg.resizeAmount}
    bind-key L resize-pane -R ${toString cfg.resizeAmount}
  '';

  paneBorderConfig = lib.optionalString cfg.paneBorder.enable ''
    ${mkSetGlobal "pane-border-indicators" cfg.paneBorder.indicators}
    ${mkSetGlobal "pane-border-lines" cfg.paneBorder.lines}
    ${mkSetWindowGlobal "pane-border-status" cfg.paneBorder.status}
    ${lib.optionalString cfg.paneBorder.title.enable ''
      setw -g pane-border-format '${cfg.paneBorder.title.format}'
    ''}
    ${lib.optionalString cfg.paneBorder.autoHideSinglePane.enable ''
      set-hook -g after-split-window '${borderToggle}'
      set-hook -g after-kill-pane '${borderToggle}'
      set-hook -g pane-exited '${borderToggle}'
      set-hook -g after-select-window '${borderToggle}'
    ''}
    ${mkSetGlobal "pane-active-border-style" "'${cfg.paneBorder.activeStyle}'"}
  '';

  terminalTitleConfig = lib.optionalString cfg.terminalTitle.enable ''
    set -g set-titles on
    set -g set-titles-string "${cfg.terminalTitle.format}"
  '';

  generatedConfig = lib.concatStringsSep "\n" (
    lib.filter (value: value != "") [
      baseConfig
      terminalFeaturesConfig
      pluginConfig
      catppuccinStatusConfig
      (lib.optionalString cfg.extendedKeys.enable ''
        set -g extended-keys on
        set -g extended-keys-format csi-u
      '')
      (lib.optionalString cfg.popupBindings.sessionSelector.enable ''
        bind-key -T prefix s display-popup -E "nu --login -i -c '${cfg.sessionSelector.commandName}'"
      '')
      (lib.optionalString cfg.popupBindings.navi.enable ''
        bind-key -T prefix g display-popup -w '95%' -h '95%' -d "#{pane_current_path}" -E "nu --login -i -c 'nv'"
      '')
      (lib.optionalString cfg.splitBindings.enable ''
        bind \" split-window -v -c '#{pane_current_path}'
        bind \' split-window -h -c '#{pane_current_path}'
      '')
      customPaneNavigationAndResizeConfig
      (lib.optionalString cfg.viCopyMode.enable ''
        bind -T copy-mode-vi v   send -X begin-selection
        bind -T copy-mode-vi V   send -X select-line
        bind -T copy-mode-vi C-v send -X rectangle-toggle
        bind -T copy-mode-vi y   send -X copy-selection
        bind -T copy-mode-vi Y   send -X copy-line
      '')
      paneBorderConfig
      (lib.optionalString cfg.bell.disable ''
        set-option -g bell-action none
        set-option -g visual-bell off
      '')
      (lib.optionalString cfg.passthrough.enable ''
        set -g allow-passthrough on
      '')
      terminalTitleConfig
      (lib.optionalString cfg.renumberWindows.enable ''
        set -g renumber-windows on
      '')
      (lib.optionalString cfg.automaticRename.enable ''
        setw -g automatic-rename on
        set -g automatic-rename-format "${cfg.automaticRename.format}"
      '')
      cfg.extraConfig
    ]
  );
in
{
  options.dot.programs.tmux = {
    enable = lib.mkEnableOption "tmux";

    package = lib.mkPackageOption pkgs "tmux" { };

    terminal = lib.mkOption {
      type = lib.types.str;
      default = "screen-256color";
      description = "Terminal type advertised by tmux.";
    };

    shell = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Shell used by tmux. When null, default-shell is not set.";
    };

    defaultCommand = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "tmux default-command. When null, it is not set.";
    };

    baseIndex = lib.mkOption {
      type = lib.types.int;
      default = 0;
      description = "tmux base-index and pane-base-index.";
    };

    prefix = lib.mkOption {
      type = lib.types.str;
      default = "C-b";
      description = "tmux prefix key.";
    };

    resizeAmount = lib.mkOption {
      type = lib.types.int;
      default = 5;
      description = "Pane resize amount for custom pane resize bindings.";
    };

    historyLimit = lib.mkOption {
      type = lib.types.int;
      default = 50000;
      description = "tmux history-limit.";
    };

    keyMode = lib.mkOption {
      type = lib.types.enum [
        "emacs"
        "vi"
      ];
      default = "emacs";
      description = "tmux copy mode key bindings.";
    };

    mouse = lib.mkEnableOption "tmux mouse support";
    customPaneNavigationAndResize = lib.mkEnableOption "custom pane navigation and resize bindings";

    plugins = {
      sensible.enable = lib.mkEnableOption "tmux sensible plugin";
      resurrect.enable = lib.mkEnableOption "tmux resurrect plugin";
    };

    catppuccin = {
      enable = lib.mkEnableOption "catppuccin tmux status configuration";
      flavor = lib.mkOption {
        type = lib.types.str;
        default = "macchiato";
        description = "Catppuccin flavor.";
      };
    };

    status = {
      paneForegroundCommand.enable = lib.mkEnableOption "argv[0]-based pane command in status-left";
      windowNotice.enable = lib.mkEnableOption "@window_notice marker in window status";
    };

    terminalFeatures = lib.mkOption {
      type = lib.types.attrsOf (lib.types.listOf lib.types.str);
      default = { };
      description = "tmux terminal-features entries keyed by terminal name.";
    };

    extendedKeys.enable = lib.mkEnableOption "tmux extended keys";
    passthrough.enable = lib.mkEnableOption "tmux allow-passthrough";

    terminalTitle = {
      enable = lib.mkEnableOption "tmux set-titles";
      format = lib.mkOption {
        type = lib.types.str;
        default = "#T";
        description = "tmux set-titles-string value.";
      };
    };

    popupBindings = {
      sessionSelector.enable = lib.mkEnableOption "prefix+s session-selector popup";
      navi.enable = lib.mkEnableOption "prefix+g navi popup";
    };

    splitBindings.enable = lib.mkEnableOption "split-window bindings that preserve pane_current_path";
    viCopyMode.enable = lib.mkEnableOption "vi copy-mode bindings";

    paneBorder = {
      enable = lib.mkEnableOption "pane border configuration";
      indicators = lib.mkOption {
        type = lib.types.str;
        default = "off";
        description = "pane-border-indicators value.";
      };
      lines = lib.mkOption {
        type = lib.types.str;
        default = "single";
        description = "pane-border-lines value.";
      };
      status = lib.mkOption {
        type = lib.types.str;
        default = "off";
        description = "pane-border-status value.";
      };
      activeStyle = lib.mkOption {
        type = lib.types.str;
        default = "fg=green";
        description = "pane-active-border-style value.";
      };
      title = {
        enable = lib.mkEnableOption "pane border title format";
        format = lib.mkOption {
          type = lib.types.str;
          default = " #P #{pane_title} ";
          description = "pane-border-format value.";
        };
      };
      autoHideSinglePane.enable = lib.mkEnableOption "pane border status auto-hide for single-pane windows";
    };

    bell.disable = lib.mkEnableOption "tmux bell and visual-bell disablement";

    automaticRename = {
      enable = lib.mkEnableOption "tmux automatic-rename";
      format = lib.mkOption {
        type = lib.types.str;
        default = "Window";
        description = "automatic-rename-format value.";
      };
    };

    renumberWindows.enable = lib.mkEnableOption "tmux renumber-windows";

    sessionSelector = {
      enable = lib.mkEnableOption "tmux session selector shell function";
      commandName = lib.mkOption {
        type = lib.types.str;
        default = "tm";
        description = "Shell function name for selecting tmux sessions.";
      };
      defaultSessionName = lib.mkOption {
        type = lib.types.str;
        default = "main";
        description = "Session created when no tmux sessions exist.";
      };
      zshIntegration.enable = lib.mkEnableOption "zsh integration";
      nushellIntegration.enable = lib.mkEnableOption "nushell integration";
    };

    extraConfig = lib.mkOption {
      type = lib.types.lines;
      default = "";
      description = "Additional tmux configuration appended after generated configuration.";
    };
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ];

    xdg.configFile."tmux/tmux.conf".text = generatedConfig;

    programs = {
      zsh.initContent = lib.mkIf (
        cfg.sessionSelector.enable && cfg.sessionSelector.zshIntegration.enable
      ) sessionSelector.zsh;

      nushell.extraConfig = lib.mkIf (
        cfg.sessionSelector.enable && cfg.sessionSelector.nushellIntegration.enable
      ) sessionSelector.nushell;
    };
  };
}
