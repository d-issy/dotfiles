{
  config,
  lib,
  pkgs,
  ...
}:

with lib;
let
  # Print a pane's foreground command by argv[0] (kernel comm can be a version-named binary).
  tmuxPaneCmd = pkgs.writeShellScript "tmux-pane-cmd" ''
    tty=''${1#/dev/}
    [ -n "$tty" ] || exit 0
    # foreground pgid; its leader has pid == pgid == tpgid
    fpgid=$(ps -t "$tty" -o tpgid= 2>/dev/null | ${pkgs.gawk}/bin/awk 'NR==1{gsub(/ /,"");print;exit}')
    case "$fpgid" in
      "" | *[!0-9]*) ;;
      *)
        argv0=$(ps -o command= -p "$fpgid" 2>/dev/null | ${pkgs.gawk}/bin/awk '{print $1; exit}')
        if [ -n "$argv0" ]; then
          name=''${argv0##*/}
          printf '%s' "''${name#-}"
          exit 0
        fi
        ;;
    esac
    # fallback: kernel comm basename
    ps -o comm= -p "$fpgid" 2>/dev/null | ${pkgs.gawk}/bin/awk '{sub(/.*\//,"",$1); print $1; exit}'
  '';

  # Show the pane's window notice (set by the tmux-pane-title extension) before the window name.
  windowNotice = "#{?@window_notice, #{@window_notice},}";

  # Hide the pane border status line when a window has a single pane.
  borderToggle = ''if -F "#{==:#{window_panes},1}" "setw pane-border-status off" "setw pane-border-status top"'';
in
{
  config = {
    programs = {
      tmux = {
        enable = true;

        terminal = "tmux-256color";
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
              set -g @catppuccin_flavor "macchiato" # latte, frappe, macchiato, mocha
              set -g @catppuccin_status_background "none"
              set -g @catppuccin_window_status_style "none"
              set -g @catppuccin_pane_status_enabled "off"
              set -g @catppuccin_pane_border_status "off"

              set -g window-status-format " #I${windowNotice}#{?#{!=:#{window_name},Window},: #W,} "
              set -g window-status-style "bg=#{@thm_bg},fg=#{@thm_rosewater}"
              set -g window-status-last-style "bg=#{@thm_bg},fg=#{@thm_peach}"
              set -g window-status-activity-style "bg=#{@thm_red},fg=#{@thm_bg}"
              set -g window-status-bell-style "bg=#{@thm_red},fg=#{@thm_bg},bold"
              set -gF window-status-separator "#[bg=#{@thm_bg},fg=#{@thm_overlay_0}]│"
              set -g window-status-current-format " #I${windowNotice}#{?#{!=:#{window_name},Window},: #W,} "
              set -g window-status-current-style "bg=#{@thm_peach},fg=#{@thm_bg},bold"

              set -g  status-left-length 100
              set -g status-left ""
              set -ga status-left "#{?client_prefix,#{#[bg=#{@thm_red},fg=#{@thm_bg},bold]  #S },#{#[bg=#{@thm_bg},fg=#{@thm_green}]  #S }}"
              # show argv[0] basename (see tmuxPaneCmd) instead of the kernel comm
              set -ga status-left "#[bg=#{@thm_bg},fg=#{@thm_maroon}]  #(${tmuxPaneCmd} #{pane_tty}) "

              set -g status-right-length 100
              set -g status-right ""
              set -ga status-right "#[bg=#{@thm_bg},fg=#{@thm_yellow}]#{?window_zoomed_flag,  zoom ,}"
              set -ga status-right "#[bg=#{@thm_bg},fg=#{@thm_blue}] 󰭦 %Y-%m-%d 󰅐 %H:%M "

              set -g status-justify "absolute-centre"
            '';
          }
        ];

        extraConfig = ''
          set -as terminal-features ',xterm-256color:bpaste:ccolour:clipboard:cstyle:focus:RGB:sixel:title'
          set -as terminal-features ',xterm-ghostty:256:bpaste:ccolour:clipboard:hyperlinks:cstyle:extkeys:focus:ignorefkeys:margins:mouse:osc7:overline:rectfill:RGB:sixel:strikethrough:sync:title:usstyle:progressbar'
          set -g extended-keys on
          set -g extended-keys-format csi-u
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
          setw -g pane-border-status off
          setw -g pane-border-format ' #P#{?#{||:#{==:#{pane_title},π},#{==:#{pane_title}, }}, #{pane_title}, #{pane_title}} '
          set-hook -g after-split-window '${borderToggle}'
          set-hook -g after-kill-pane '${borderToggle}'
          set-hook -g pane-exited '${borderToggle}'
          set-hook -g after-select-window '${borderToggle}'
          set -g pane-active-border-style 'fg=#ffb86c'

          # disable bell
          set-option -g bell-action none
          set-option -g visual-bell off

          # allow apps to pass escapes to the outer terminal
          set -g allow-passthrough on

          # propagate the running program's title to the outer terminal
          set -g set-titles on
          set -g set-titles-string "#T"

          # basic
          set -g renumber-windows on
          setw -g automatic-rename on
          set -g automatic-rename-format "Window"
        '';
      };

      zsh.initContent = ''
        function tm() {
          if ! tmux has-session 2>/dev/null; then
            tmux new-session -s main -c $HOME -d
          fi

          target=$(
            tmux list-sessions -F "#S" | ${config.dot.options.fuzzyFinder.command} \
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

      nushell.extraConfig = ''
        export def tm [] {
          if (tmux has-session | complete | get exit_code | $in != 0) {
            tmux new-session -s main -c $env.HOME -d
          }

          mut target = (
            tmux list-sessions -F "#S" | ${config.dot.options.fuzzyFinder.command}
              --header='Ctrl+C: new | Ctrl-D: delete'
              --bind='ctrl-c:reload(zoxide query --list)'
              --bind='ctrl-d:execute(tmux kill-session -t {1})+reload(tmux list-sessions -F "#S")'
            | complete | get "stdout" | str trim
          )

          if ($target | is-empty) { return }
          if (tmux has-session -t $target | complete | get exit_code | $in != 0) {
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
  };
}
