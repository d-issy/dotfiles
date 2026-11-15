{ config, pkgs, ... }:

let
  cfg = config.dot.programs.tmux;
  fieldSep = builtins.fromJSON ''"\u001f"'';

  paneNoticeShellFunctions = ''
    split_icons() {
      local raw_icons="$1"
      PARTS=()
      local IFS='|'
      read -r -a PARTS <<< "$raw_icons"
    }

    notice_icon_at() {
      local raw_icons="$1"
      local frame="$2"

      split_icons "$raw_icons"
      if (( ''${#PARTS[@]} == 0 )); then
        return 0
      fi

      local local_frame=$((frame % (''${#PARTS[@]} + 1)))
      if (( local_frame >= ''${#PARTS[@]} )); then
        printf '%s' "''${PARTS[0]}"
      else
        printf '%s' "''${PARTS[$local_frame]}"
      fi
    }
  '';

  anyNoticeShellFunctions = ''
    # One list-panes call fills these lookups for the whole script run.
    declare -A session_notice_color=()
    declare -A window_has_notice=()

    load_notice_panes() {
      local pane_session_id
      local pane_window_id
      local notice_name
      local session_notification_indicator_color

      while IFS=$'\037' read -r pane_session_id pane_window_id notice_name session_notification_indicator_color; do
        [[ -n "$notice_name" ]] || continue
        window_has_notice[$pane_window_id]=1
        [[ -z "''${session_notice_color[$pane_session_id]+set}" ]] || continue
        session_notice_color[$pane_session_id]="''${session_notification_indicator_color:-${cfg.status.sessionList.colors.noticeBright}}"
      done < <(${cfg.package}/bin/tmux list-panes -a -F '#{session_id}${fieldSep}#{window_id}${fieldSep}#{@tmux_notice_name}${fieldSep}#{@tmux_notice_session_notification_indicator_color}' 2>/dev/null || true)
    }

    any_notice_in_window() {
      local window_id="$1"
      local notice_name

      while IFS= read -r notice_name; do
        [[ -n "$notice_name" ]] || continue
        return 0
      done < <(${cfg.package}/bin/tmux list-panes -t "$window_id" -F '#{@tmux_notice_name}' 2>/dev/null || true)

      return 1
    }

    blink_icon() {
      local frame="$1"
      if (( frame % 2 == 0 )); then
        printf '•'
      else
        printf ' '
      fi
    }
  '';
in
{
  paneNotice = pkgs.writeShellScriptBin "tmux-pane-notice" ''
    target_pane=''${1-}
    notice_scope=''${2-}
    pane_label=''${3-}
    [ -n "$target_pane" ] || exit 0

    printf -v frame '%(%s)T' -1

    ${paneNoticeShellFunctions}

    line=$(${cfg.package}/bin/tmux display-message -p -t "$target_pane" '#{@tmux_notice_icons}${fieldSep}#{@pane_notice_icon}${fieldSep}#{@pane_notice_title}${fieldSep}#{pane_title}' 2>/dev/null || true)
    IFS=$'\037' read -r raw_icons fallback_icon notice_title pane_title <<< "$line"

    if [[ -z "$raw_icons" ]]; then
      raw_icons="$fallback_icon"
    fi
    if [[ -z "$notice_title" ]]; then
      notice_title="$pane_title"
    fi

    if [[ -z "$raw_icons" ]]; then
      if [[ "$notice_scope" == "inactive" && -n "$pane_label" ]]; then
        printf '#[%s]%s %s' "${cfg.paneBorder.title.inactiveStyle}" "$pane_label" "$pane_title"
      else
        printf '%s' "$pane_title"
      fi
      exit 0
    fi

    icon=$(notice_icon_at "$raw_icons" "$frame")
    if [[ "$notice_scope" == "inactive" ]]; then
      printf '#[%s]%s ' "${cfg.paneBorder.title.inactiveStyle}" "$pane_label"
      if [[ "$icon" =~ [^[:space:]] ]]; then
        printf '#[fg=%s]%s' "${cfg.status.sessionList.colors.noticeBright}" "$icon"
      else
        printf '%s' "$icon"
      fi
      printf '#[%s] %s' "${cfg.paneBorder.title.inactiveStyle}" "$notice_title"
    else
      printf '%s %s' "$icon" "$notice_title"
    fi
  '';

  sessions = pkgs.writeShellScriptBin "tmux-status-sessions" ''
    current_session_id=''${1-}
    client_width=''${2:-0}
    session_windows=''${3:-1}
    printf -v frame '%(%s)T' -1

    ${anyNoticeShellFunctions}

    load_notice_panes

    output=""
    session_list_width=0
    while IFS=$'\037' read -r session_id session_name; do
      [[ -n "$session_id" ]] || continue

      name_color="${cfg.status.sessionList.colors.inactive}"
      if [[ "$session_id" == "$current_session_id" ]]; then
        name_color="${cfg.status.sessionList.colors.active}"
      fi

      icon=""
      if [[ -n "''${session_notice_color[$session_id]+set}" ]]; then
        session_notification_indicator_color="''${session_notice_color[$session_id]}"
        icon=$(blink_icon "$frame")
      fi

      output+="#[range=session|$session_id]"
      if [[ -n "$icon" ]]; then
        output+="#[fg=$session_notification_indicator_color]$icon"
      fi
      output+="#[fg=$name_color]$session_name  #[norange]"
      session_list_width=$(( session_list_width + ''${#icon} + ''${#session_name} + 2 ))
    done < <(${cfg.package}/bin/tmux list-sessions -F '#{session_id}${fieldSep}#{session_name}' 2>/dev/null || true)

    if [[ "$client_width" =~ ^[0-9]+$ && "$session_windows" =~ ^[0-9]+$ && "$session_windows" -gt 1 ]]; then
      window_list_width=0
      while IFS=$'\037' read -r window_id window_index window_name; do
        window_width=$(( ''${#window_index} + 2 ))
        if [[ "$window_name" != "Window" ]]; then
          window_width=$(( window_width + ''${#window_name} + 1 ))
        fi
        if [[ -n "''${window_has_notice[$window_id]+set}" ]]; then
          window_width=$(( window_width + 1 ))
        fi
        window_list_width=$(( window_list_width + window_width ))
      done < <(${cfg.package}/bin/tmux list-windows -t "$current_session_id" -F '#{window_id}${fieldSep}#{window_index}${fieldSep}#{window_name}' 2>/dev/null || true)
      if (( session_windows > 1 )); then
        window_list_width=$(( window_list_width + session_windows - 1 ))
      fi

      # Prefer a true absolute centre. If the full session list would collide
      # with that centred window list, fall back to tmux's non-overlapping centre
      # layout instead of abbreviating session names.
      left_prefix_width=6
      safe_left_limit=$(( client_width / 2 - (window_list_width + 1) / 2 - 1 ))
      if (( left_prefix_width + session_list_width > safe_left_limit )); then
        target_justify="centre"
      else
        target_justify="absolute-centre"
      fi
      current_justify=$(${cfg.package}/bin/tmux show-options -qv -t "$current_session_id" status-justify 2>/dev/null || true)
      if [[ "$current_justify" != "$target_justify" ]]; then
        ${cfg.package}/bin/tmux set-option -q -t "$current_session_id" status-justify "$target_justify" 2>/dev/null || true
      fi
    fi

    printf '%s' "$output"
  '';

  windowNotices = pkgs.writeShellScriptBin "tmux-status-window-notices" ''
    target_window=''${1-}
    [ -n "$target_window" ] || exit 0

    printf -v frame '%(%s)T' -1

    ${anyNoticeShellFunctions}

    if any_notice_in_window "$target_window"; then
      blink_icon "$frame"
    fi
  '';
}
