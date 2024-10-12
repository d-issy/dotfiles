{ config, pkgs, ... }:

{
  options = { };
  config = {
    programs.tmux = {
      enable = true;

      terminal = "screen-256color";
      shell = "${pkgs.zsh}/bin/zsh";

      baseIndex = 1;
      customPaneNavigationAndResize = true;
      historyLimit = 9999999;
      keyMode = "vi";
      mouse = true;
      prefix = "C-q";
      resizeAmount = 5;

      plugins = with pkgs; [
        tmuxPlugins.sensible
        tmuxPlugins.resurrect
        {
          plugin = tmuxPlugins.catppuccin;
          extraConfig = ''
            set -g @catppuccin_flavour 'macchiato' # latte, frappe, macchiato, mocha
            set -g @catppuccin_status_background "default"
            set -g @catppuccin_window_current_fill "number"
            set -g @catppuccin_status_modules_left "session"
            set -g @catppuccin_status_modules_right "date_time"
            set -g @catppuccin_window_default_fill "number"
            set -g @catppuccin_window_default_text "#W"
            set -g @catppuccin_window_current_fill "number"
            set -g @catppuccin_window_current_text "#W"
            set -g @catppuccin_window_left_separator " █"
            set -g @catppuccin_window_right_separator "█"
            set -g @catppuccin_status_left_separator "█"
            set -g @catppuccin_status_right_separator "█"
            set -g @catppuccin_date_time_text "%Y-%m-%d"
          '';
        }
      ];

      extraConfig = ''
        set -g default-command "${pkgs.nushell}/bin/nu"

        # bind
        bind-key -T prefix s display-popup -E "$SHELL --login -i -c 'tm'"
        bind-key -T prefix g display-popup -w '80%' -h '80%' -d "#{pane_current_path}" -E "$SHELL --login -i -c 'nv tmux-popup'"
        bind \" split-window -v -c '#{pane_current_path}'
        bind \' split-window -h -c '#{pane_current_path}'

        # copy
        set-window-option -g mode-keys vi
        setw -g mode-keys vi
        bind -T copy-mode-vi v   send -X begin-selection
        bind -T copy-mode-vi V   send -X select-line
        bind -T copy-mode-vi C-v send -X rectangle-toggle
        bind -T copy-mode-vi y   send -X copy-selection
        bind -T copy-mode-vi Y   send -X copy-line

        # border
        set -g pane-border-indicators off
        set -g pane-border-lines heavy
        set -g pane-active-border-style 'fg=#ffb86c'

        # disable bell
        set-option -g bell-action none
        set-option -g visual-bell off

        # basic
        set -g renumber-windows on
        setw -g automatic-rename on
      '';
    };
  };
}
