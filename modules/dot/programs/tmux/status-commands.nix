{ config, pkgs, ... }:

let
  cfg = config.dot.programs.tmux;
in
{
  sessions = pkgs.writeShellScript "tmux-status-sessions" ''
    current_session_id=''${1-}
    frame=$(( $(${pkgs.coreutils}/bin/date +%s%3N) / ${toString cfg.status.sessionList.blinkIntervalMs} ))

    {
      ${cfg.package}/bin/tmux list-sessions -F '#{session_id}	#{session_name}' \
        | ${pkgs.gawk}/bin/awk -F '\t' '{ print "S\t" $1 "\t" $2 }'
      ${cfg.package}/bin/tmux list-panes -a -F '#{session_id}	#{@status_notice_icon}' \
        | ${pkgs.gawk}/bin/awk -F '\t' '{ print "P\t" $1 "\t" $2 }'
    } 2>/dev/null \
      | ${pkgs.gawk}/bin/awk -F '\t' \
        -v current_session_id="$current_session_id" \
        -v frame="$frame" \
        -v active_color="${cfg.status.sessionList.colors.active}" \
        -v inactive_color="${cfg.status.sessionList.colors.inactive}" \
        -v notice_bright_color="${cfg.status.sessionList.colors.noticeBright}" \
        -v notice_dim_color="${cfg.status.sessionList.colors.noticeDim}" '
        $1 == "S" {
          session_ids[++session_count] = $2
          session_names[session_count] = $3
          next
        }

        $1 == "P" && $3 != "" {
          session_id = $2
          icon = $3
          if (!icon_seen[session_id SUBSEP icon]++) {
            icons[session_id, ++icon_counts[session_id]] = icon
          }
          next
        }

        END {
          for (i = 1; i <= session_count; i++) {
            session_id = session_ids[i]
            icon_count = icon_counts[session_id] + 0
            name_color = (session_id == current_session_id) ? active_color : inactive_color

            printf "#[range=session|%s]", session_id
            for (j = 1; j <= icon_count; j++) {
              icon_bright = (icon_count == 1) ? (frame % 2 == 0) : ((j - 1) == frame % icon_count)
              icon_color = icon_bright ? notice_bright_color : notice_dim_color
              printf "#[fg=%s]%s ", icon_color, icons[session_id, j]
            }
            printf "#[fg=%s]%s  #[norange]", name_color, session_names[i]
          }
        }
      '
  '';

  windowNotices = pkgs.writeShellScript "tmux-status-window-notices" ''
    target_window=''${1-}
    [ -n "$target_window" ] || exit 0

    frame=$(( $(${pkgs.coreutils}/bin/date +%s%3N) / ${toString cfg.status.windowNotice.blinkIntervalMs} ))

    ${cfg.package}/bin/tmux list-panes -t "$target_window" -F '#{@status_notice_icon}' 2>/dev/null \
      | ${pkgs.gawk}/bin/awk \
        -v frame="$frame" '
          $0 != "" {
            icon = $0
            if (!icon_seen[icon]++) icons[++icon_count] = icon
          }

          END {
            if (icon_count == 0) exit

            printf " "
            active = (icon_count == 1) ? frame % 2 : frame % icon_count
            for (i = 1; i <= icon_count; i++) {
              if (i > 1) printf " "
              printf "%s", ((i - 1) == active) ? icons[i] : " "
            }
          }
        '
  '';
}
