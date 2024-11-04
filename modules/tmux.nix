{ config, lib, pkgs, ... }:

with lib;
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
        bind-key -T prefix s display-popup                                             -E "nu --login -i -c 'tm'"
        bind-key -T prefix g display-popup -w '95%' -h '95%' -d "#{pane_current_path}" -E "nu --login -i -c 'nv'"
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

    programs.zsh.initExtra = ''
      function tm() {
        if ! tmux has-session 2>/dev/null; then
          tmux new-session -s main -c $HOME -d
        fi

        target=$(
          tmux list-sessions -F "#S" | fzf \
            --header='Ctrl+C: new | Ctrl-D: delete' \
            --bind='ctrl-c:reload(zoxide query --list)' \
            --bind='ctrl-d:execute(tmux kill-session -t {1})+reload(tmux list-sessions -F "#S")'
        )

        if [ -z "$target" ]; then
          return
        fi

        if ! tmux has-session -t "$target" 2>/dev/null; then
          session_name=$(basename "$target")
          tmux new-session -s $session_name -c "$target" -d
          target="$session_name"
        fi

        if [ -z "$TMUX" ]; then
          tmux attach-session -t "$target"
        else
          tmux switch-client -t "$target"
        fi
      }
    '';

    programs.nushell.extraConfig = ''
      export def tm [] {
        if (tmux has-session | complete | get exit_code | $in != 0) {
          tmux new-session -s main -c $env.HOME -d
        }

        mut target = (
          tmux list-sessions -F "#S" | fzf
            --header='Ctrl+C: new | Ctrl-D: delete'
            --bind='ctrl-c:reload(zoxide query --list)'
            --bind='ctrl-d:execute(tmux kill-session -t {1})+reload(tmux list-sessions -F "#S")'
          | complete | get "stdout" | str trim
        )

        if ($target | is-empty) { return }
        if (tmux has-session -t $target | complete | get exit_code | $in != 0) {
          echo hello
          let session_name = $target | path basename
          tmux new-session -s $session_name -c $target -d
          $target = $session_name
        }

        if ($env.TMUX | is-empty) {
          tmux attach-session -t $target
        } else {
          tmux switch-client -t $target
        }
      }
    '';
  };
}
