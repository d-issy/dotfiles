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
    any_notice_by_session() {
      local session_id="$1"
      local notice_name

      while IFS=$'\037' read -r pane_session_id notice_name; do
        [[ "$pane_session_id" == "$session_id" && -n "$notice_name" ]] || continue
        return 0
      done < <(${cfg.package}/bin/tmux list-panes -a -F '#{session_id}${fieldSep}#{@tmux_notice_name}' 2>/dev/null || true)

      return 1
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
  paneNotice = pkgs.writeShellScript "tmux-pane-notice" ''
    target_pane=''${1-}
    notice_scope=''${2-}
    pane_label=''${3-}
    [ -n "$target_pane" ] || exit 0

    frame=$(( $(${pkgs.coreutils}/bin/date +%s%3N) / ${toString cfg.status.windowNotice.blinkIntervalMs} ))

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

  sessions = pkgs.writeShellScript "tmux-status-sessions" ''
    current_session_id=''${1-}
    frame=$(( $(${pkgs.coreutils}/bin/date +%s%3N) / ${toString cfg.status.sessionList.blinkIntervalMs} ))

    ${anyNoticeShellFunctions}

    while IFS=$'\037' read -r session_id session_name; do
      [[ -n "$session_id" ]] || continue

      name_color="${cfg.status.sessionList.colors.inactive}"
      if [[ "$session_id" == "$current_session_id" ]]; then
        name_color="${cfg.status.sessionList.colors.active}"
      fi

      printf '#[range=session|%s]' "$session_id"
      if any_notice_by_session "$session_id"; then
        icon=$(blink_icon "$frame")
        printf '#[fg=%s]%s' "${cfg.status.sessionList.colors.noticeBright}" "$icon"
      fi
      printf '#[fg=%s]%s  #[norange]' "$name_color" "$session_name"
    done < <(${cfg.package}/bin/tmux list-sessions -F '#{session_id}${fieldSep}#{session_name}' 2>/dev/null || true)
  '';

  windowNotices = pkgs.writeShellScript "tmux-status-window-notices" ''
    target_window=''${1-}
    [ -n "$target_window" ] || exit 0

    frame=$(( $(${pkgs.coreutils}/bin/date +%s%3N) / ${toString cfg.status.windowNotice.blinkIntervalMs} ))

    ${anyNoticeShellFunctions}

    if any_notice_in_window "$target_window"; then
      blink_icon "$frame"
    fi
  '';
}
