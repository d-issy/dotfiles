{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.tmux;
  paneCommand = import ./pane-command.nix { inherit pkgs; };
  sessionSelector = import ./session-selector.nix { inherit config pkgs; };
  statusCommands = import ./status-commands.nix { inherit config pkgs; };
  tmuxNoticeCfg = config.dot.programs.scripts.tmuxNotice;
  tmuxNoticeCommand = "${tmuxNoticeCfg.package}/bin/tmux-notice";

  borderToggle = ''if -F "#{==:#{window_panes},1}" "setw pane-border-status off" "setw pane-border-status ${cfg.paneBorder.title.position}"'';
  activeBorderToggle = ''if -F "#{==:#{window_panes},1}" "setw pane-active-border-style '${cfg.paneBorder.activeStyleWhenSinglePane}'" "setw pane-active-border-style '${cfg.paneBorder.activeStyle}'"'';
  runInCurrentWindow = command: ''
    if -F "#{window_id}" {
      ${command}
    }
  '';
  activeBorderHookFlag = if cfg.paneBorder.hideWhenSinglePane then "-ag" else "-g";
  paneBorderTitleNotice = "#(${statusCommands.paneNotice} #{q:pane_id})";
  paneBorderTitleInactiveNotice = "#(${statusCommands.paneNotice} #{q:pane_id} inactive #{q:pane_index})";
  paneBorderTitleFormat =
    if cfg.paneBorder.title.format == null then
      " #{?pane_active,#[${cfg.paneBorder.title.activeStyle}]#P ${paneBorderTitleNotice},#[${cfg.paneBorder.title.inactiveStyle}]${paneBorderTitleInactiveNotice}} "
    else
      cfg.paneBorder.title.format;
  resizeRepeatFlag = lib.optionalString cfg.keyBindings.paneResize.repeatable "-r ";

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
    ${mkSetGlobal "status-position" cfg.status.position}
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
    (lib.optionalString cfg.plugins.catppuccin.enable ''
      set -g @catppuccin_flavor "${cfg.plugins.catppuccin.flavor}" # latte, frappe, macchiato, mocha
      set -g @catppuccin_status_background "none"
      set -g @catppuccin_window_status_style "none"
      set -g @catppuccin_pane_status_enabled "off"
      set -g @catppuccin_pane_border_status "off"
      source-file ${pluginPath "catppuccin" pkgs.tmuxPlugins.catppuccin}/catppuccin_tmux.conf
    '')
  ];

  statusPaneCommand =
    if cfg.status.paneForegroundCommand.enable then
      "#(${paneCommand.command} #{pane_tty})"
    else
      "#{pane_current_command}";

  windowNoticeText = lib.optionalString cfg.status.windowNotice.enable "#(${statusCommands.windowNotices} #{q:window_id})";
  statusSessions = lib.optionalString cfg.status.sessionList.enable "#(${statusCommands.sessions} #{q:session_id})";
  statusNeedsRefresh =
    cfg.status.sessionList.enable || cfg.status.windowNotice.enable || tmuxNoticeCfg.enable;

  # Single-window sessions hide the index; multi-window sessions show
  # "#I[: notice #W]". Shared between the normal and current formats below.
  windowStatusContent = "#{?#{>:#{session_windows},1}, ${windowNoticeText}#I#{?#{!=:#{window_name},Window},:#W,} ,}";

  catppuccinStatusConfig = lib.optionalString cfg.plugins.catppuccin.enable ''
    set -g window-status-format "${windowStatusContent}"
    set -g window-status-style "bg=#{@thm_bg},fg=#{@thm_rosewater}"
    set -g window-status-last-style "bg=#{@thm_bg},fg=#{@thm_peach}"
    set -g window-status-activity-style "bg=#{@thm_red},fg=#{@thm_bg}"
    set -g window-status-bell-style "bg=#{@thm_red},fg=#{@thm_bg},bold"
    set -gF window-status-separator "#[bg=#{@thm_bg},fg=#{@thm_overlay_0}]│"
    set -g window-status-current-format "${windowStatusContent}"
    set -g window-status-current-style "bg=#{@thm_peach},fg=#{@thm_bg},bold"

    set -g  status-left-length 200
    set -g status-left ""
    set -ga status-left "#{?client_prefix,#{#[bg=#{@thm_red},fg=#{@thm_bg},bold]  },#{#[bg=#{@thm_bg},fg=#{@thm_green}]  }}#[bg=#{@thm_bg},fg=#{@thm_overlay_0}]│ "
    set -ga status-left "${statusSessions}"

    ${lib.optionalString statusNeedsRefresh "set -g status-interval 1"}

    set -g status-right-length 160
    set -g status-right ""
    set -ga status-right "#[bg=#{@thm_bg},fg=#{@thm_yellow}]#{?window_zoomed_flag,  zoom ,}"
    set -ga status-right "#[bg=#{@thm_bg},fg=#{@thm_maroon}]  ${statusPaneCommand} "
    set -ga status-right "#[bg=#{@thm_bg},fg=#{@thm_overlay_0}]│ "
    set -ga status-right "#[bg=#{@thm_bg},fg=#{@thm_blue}]󰭦 %Y-%m-%d %H:%M "

    set -g status-justify "absolute-centre"
  '';

  paneNavigationAndResizeBindingsConfig = lib.optionalString cfg.keyBindings.paneNavigationAndResize.enable ''
    bind-key h select-pane -L
    bind-key j select-pane -D
    bind-key k select-pane -U
    bind-key l select-pane -R
    bind-key ${resizeRepeatFlag}H resize-pane -L ${toString cfg.keyBindings.paneResize.amount}
    bind-key ${resizeRepeatFlag}J resize-pane -D ${toString cfg.keyBindings.paneResize.amount}
    bind-key ${resizeRepeatFlag}K resize-pane -U ${toString cfg.keyBindings.paneResize.amount}
    bind-key ${resizeRepeatFlag}L resize-pane -R ${toString cfg.keyBindings.paneResize.amount}
  '';

  paneBorderConfig = lib.optionalString cfg.paneBorder.enable ''
    ${mkSetGlobal "pane-border-indicators" cfg.paneBorder.indicators}
    ${mkSetGlobal "pane-border-lines" cfg.paneBorder.lines}
    ${mkSetGlobal "pane-border-style" "'${cfg.paneBorder.style}'"}
    ${mkSetWindowGlobal "pane-border-status" cfg.paneBorder.title.position}
    ${lib.optionalString cfg.paneBorder.title.enable ''
      setw -g pane-border-format '${paneBorderTitleFormat}'
    ''}
    ${
      if cfg.paneBorder.hideWhenSinglePane then
        ''
          ${runInCurrentWindow borderToggle}
          set-hook -g session-created '${borderToggle}'
          set-hook -g after-new-window '${borderToggle}'
          set-hook -g after-split-window '${borderToggle}'
          set-hook -g after-kill-pane '${borderToggle}'
          set-hook -g pane-exited '${borderToggle}'
          set-hook -g after-select-window '${borderToggle}'
        ''
      else
        ''
          setw -g pane-border-status ${cfg.paneBorder.title.position}
          set-hook -gu after-split-window
          set-hook -gu after-kill-pane
          set-hook -gu pane-exited
          set-hook -gu after-select-window
        ''
    }
    ${mkSetGlobal "pane-active-border-style" "'${cfg.paneBorder.activeStyle}'"}
    ${lib.optionalString (cfg.paneBorder.activeStyleWhenSinglePane != null) ''
      ${runInCurrentWindow activeBorderToggle}
      set-hook ${activeBorderHookFlag} session-created '${activeBorderToggle}'
      set-hook ${activeBorderHookFlag} after-new-window '${activeBorderToggle}'
      set-hook ${activeBorderHookFlag} after-split-window '${activeBorderToggle}'
      set-hook ${activeBorderHookFlag} after-kill-pane '${activeBorderToggle}'
      set-hook ${activeBorderHookFlag} pane-exited '${activeBorderToggle}'
      set-hook ${activeBorderHookFlag} after-select-window '${activeBorderToggle}'
    ''}
  '';

  terminalTitleConfig = lib.optionalString cfg.terminalTitle.enable ''
    set -g set-titles on
    set -g set-titles-string "${cfg.terminalTitle.format}"
  '';

  tmuxNoticeClearHooksConfig =
    lib.optionalString (tmuxNoticeCfg.enable && tmuxNoticeCfg.clearOnSelect.enable)
      ''
        set-hook -g after-select-pane[${toString tmuxNoticeCfg.clearOnSelect.hookIndex}] 'run-shell -b "${tmuxNoticeCommand} clear --pane -t \"#{pane_id}\""'
        set-hook -g after-select-window[${toString tmuxNoticeCfg.clearOnSelect.hookIndex}] 'run-shell -b "${tmuxNoticeCommand} clear --pane -t \"#{pane_id}\""'
        set-hook -g client-session-changed[${toString tmuxNoticeCfg.clearOnSelect.hookIndex}] 'run-shell -b "${tmuxNoticeCommand} clear --pane -t \"#{pane_id}\""'
        set-hook -g client-attached[${toString tmuxNoticeCfg.clearOnSelect.hookIndex}] 'run-shell -b "${tmuxNoticeCommand} clear --pane"'
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
      (lib.optionalString cfg.keyBindings.popups.sessionSelector.enable ''
        bind-key -T prefix s display-popup -E "nu --login -i -c '${cfg.sessionSelector.commandName}'"
      '')
      (lib.optionalString cfg.keyBindings.sessionNavigation.enable ''
        bind-key -T prefix ${cfg.keyBindings.sessionNavigation.nextKey} switch-client -n
        bind-key -T prefix ${cfg.keyBindings.sessionNavigation.previousKey} switch-client -p
      '')
      (lib.optionalString cfg.keyBindings.windowRename.enable ''
        bind-key -T prefix ${cfg.keyBindings.windowRename.key} command-prompt -I "#W" -p "Window name:" 'if -F "#{==:%1,}" "set-window-option automatic-rename on" "rename-window \"%%%\""'
      '')
      (lib.optionalString cfg.keyBindings.popups.navi.enable ''
        bind-key -T prefix g display-popup -w '95%' -h '95%' -d "#{pane_current_path}" -E "nu --login -i -c 'nv'"
      '')
      (lib.optionalString cfg.keyBindings.split.enable ''
        bind \" split-window -v -c '#{pane_current_path}'
        bind \' split-window -h -c '#{pane_current_path}'
      '')
      paneNavigationAndResizeBindingsConfig
      (lib.optionalString cfg.keyBindings.copyModeVi.enable ''
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
      tmuxNoticeClearHooksConfig
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

    plugins = {
      sensible.enable = lib.mkEnableOption "tmux sensible plugin";
      resurrect.enable = lib.mkEnableOption "tmux resurrect plugin";
      catppuccin = {
        enable = lib.mkEnableOption "catppuccin tmux plugin and status configuration";
        flavor = lib.mkOption {
          type = lib.types.str;
          default = "macchiato";
          description = "Catppuccin flavor.";
        };
      };
    };

    keyBindings = {
      paneNavigationAndResize.enable = lib.mkEnableOption "custom pane navigation and resize bindings";
      paneResize = {
        amount = lib.mkOption {
          type = lib.types.int;
          default = 5;
          description = "Pane resize amount for custom pane resize bindings.";
        };
        repeatable = lib.mkEnableOption "repeatable pane resize bindings";
      };
      popups = {
        sessionSelector.enable = lib.mkEnableOption "prefix+s session-selector popup";
        navi.enable = lib.mkEnableOption "prefix+g navi popup";
      };
      sessionNavigation = {
        enable = lib.mkEnableOption "session next/previous key bindings";
        nextKey = lib.mkOption {
          type = lib.types.str;
          default = "N";
          description = "Prefix key for switch-client -n.";
        };
        previousKey = lib.mkOption {
          type = lib.types.str;
          default = "P";
          description = "Prefix key for switch-client -p.";
        };
      };
      windowRename = {
        enable = lib.mkEnableOption "window rename prompt that restores automatic rename on empty input";
        key = lib.mkOption {
          type = lib.types.str;
          default = ",";
          description = "Prefix key for the window rename prompt.";
        };
      };
      split.enable = lib.mkEnableOption "split-window bindings that preserve pane_current_path";
      copyModeVi.enable = lib.mkEnableOption "vi copy-mode bindings";
    };

    status = {
      position = lib.mkOption {
        type = lib.types.enum [
          "top"
          "bottom"
        ];
        default = "bottom";
        description = "tmux status-position value.";
      };
      paneForegroundCommand.enable = lib.mkEnableOption "argv[0]-based pane command in status-left";
      windowNotice = {
        enable = lib.mkEnableOption "pane-scoped notice icons in window status";
        blinkIntervalMs = lib.mkOption {
          type = lib.types.ints.positive;
          default = 900;
          description = "Notice icon blink interval in the window list.";
        };
      };
      sessionList = {
        enable = lib.mkEnableOption "clickable tmux session list with pane notices in status-left";
        blinkIntervalMs = lib.mkOption {
          type = lib.types.ints.positive;
          default = 900;
          description = "Notice icon blink interval in the status session list.";
        };
        colors = {
          active = lib.mkOption {
            type = lib.types.str;
            default = "#cad3f5";
            description = "Active session name color.";
          };
          inactive = lib.mkOption {
            type = lib.types.str;
            default = "#8087a2";
            description = "Inactive session name color.";
          };
          noticeBright = lib.mkOption {
            type = lib.types.str;
            default = "#cad3f5";
            description = "Bright notice icon color.";
          };
          noticeDim = lib.mkOption {
            type = lib.types.str;
            default = "#8087a2";
            description = "Dim notice icon color.";
          };
        };
      };
    };

    terminalFeatures = lib.mkOption {
      type = lib.types.attrsOf (lib.types.listOf lib.types.str);
      default = { };
      description = "tmux terminal-features entries keyed by terminal name.";
    };

    extendedKeys.enable = lib.mkEnableOption "tmux extended keys";
    passthrough.enable = lib.mkEnableOption "tmux allow-passthrough";

    zshIntegration.enable = lib.mkOption {
      type = lib.types.bool;
      default = config.programs.zsh.enable;
      defaultText = lib.literalExpression "config.programs.zsh.enable";
      description = "Whether to enable zsh integration for tmux features by default.";
    };

    nushellIntegration.enable = lib.mkOption {
      type = lib.types.bool;
      default = config.programs.nushell.enable;
      defaultText = lib.literalExpression "config.programs.nushell.enable";
      description = "Whether to enable nushell integration for tmux features by default.";
    };

    terminalTitle = {
      enable = lib.mkEnableOption "tmux set-titles";
      format = lib.mkOption {
        type = lib.types.str;
        default = "#T";
        description = "tmux set-titles-string value.";
      };
    };

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
      style = lib.mkOption {
        type = lib.types.str;
        default = "default";
        description = "pane-border-style value.";
      };
      activeStyle = lib.mkOption {
        type = lib.types.str;
        default = "fg=green";
        description = "pane-active-border-style value.";
      };
      activeStyleWhenSinglePane = lib.mkOption {
        type = lib.types.nullOr lib.types.str;
        default = null;
        description = "pane-active-border-style value used for single-pane windows. When null, activeStyle is always used.";
      };
      title = {
        enable = lib.mkEnableOption "pane border title format";
        position = lib.mkOption {
          type = lib.types.enum [
            "off"
            "top"
            "bottom"
          ];
          default = "off";
          description = "Position of the pane border title/status line.";
        };
        activeStyle = lib.mkOption {
          type = lib.types.str;
          default = "fg=green";
          description = "Active pane title style for the generated pane-border-format.";
        };
        inactiveStyle = lib.mkOption {
          type = lib.types.str;
          default = "default";
          description = "Inactive pane title style for the generated pane-border-format.";
        };
        format = lib.mkOption {
          type = lib.types.nullOr lib.types.str;
          default = null;
          description = "Optional pane-border-format override. Defaults to a generated pane title with pane notice icons.";
        };
      };
      hideWhenSinglePane = lib.mkOption {
        type = lib.types.bool;
        default = false;
        description = "Whether to hide pane border title/status for single-pane windows.";
      };
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
      zshIntegration.enable = lib.mkOption {
        type = lib.types.bool;
        default = cfg.zshIntegration.enable;
        defaultText = lib.literalExpression "config.dot.programs.tmux.zshIntegration.enable";
        description = "Whether to install the session selector zsh integration.";
      };
      nushellIntegration.enable = lib.mkOption {
        type = lib.types.bool;
        default = cfg.nushellIntegration.enable;
        defaultText = lib.literalExpression "config.dot.programs.tmux.nushellIntegration.enable";
        description = "Whether to install the session selector nushell integration.";
      };
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
