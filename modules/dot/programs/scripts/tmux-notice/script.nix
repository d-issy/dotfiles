{
  configFile,
  lib,
  ...
}:

''
  set -euo pipefail

  config_file=${lib.escapeShellArg configFile}

  usage() {
    cat <<'EOF'
  tmux-notice - pane-local tmux notice helper

  Usage:
    tmux-notice on <notice> [-t <pane>]
    tmux-notice off [notice] [-t <pane>]
    tmux-notice clear [--pane|--window|--session|--all] [-t <target>]
    tmux-notice list

  Notices are configured by dot.programs.scripts.tmuxNotice.notices.
  EOF
  }

  target=""

  parse_target() {
    local args=()
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -t|--target)
          if [[ $# -lt 2 ]]; then
            echo "tmux-notice: missing target after $1" >&2
            exit 2
          fi
          target="$2"
          shift 2
          ;;
        -h|--help)
          usage
          exit 0
          ;;
        --)
          shift
          args+=("$@")
          break
          ;;
        *)
          args+=("$1")
          shift
          ;;
      esac
    done
    parsed_args=("''${args[@]}")
  }

  resolve_target() {
    if [[ -n "$target" ]]; then
      printf '%s' "$target"
      return 0
    fi

    if [[ -n "''${TMUX_PANE:-}" ]]; then
      printf '%s' "$TMUX_PANE"
      return 0
    fi

    return 1
  }

  get_tmux_option() {
    local pane="$1"
    local option="$2"
    tmux show-option -p -t "$pane" -v "$option" 2>/dev/null || true
  }

  set_tmux_option() {
    local pane="$1"
    local option="$2"
    local value="$3"
    tmux set-option -p -t "$pane" "$option" "$value" >/dev/null 2>&1 || true
  }

  get_pane_title() {
    local pane="$1"
    tmux display-message -p -t "$pane" '#{pane_title}' 2>/dev/null || true
  }

  set_pane_title() {
    local pane="$1"
    local title="$2"
    tmux select-pane -t "$pane" -T "$title" >/dev/null 2>&1 || true
  }

  refresh_tmux_status() {
    tmux refresh-client -S >/dev/null 2>&1 || true
  }

  pane_is_visible_active() {
    local pane="$1"
    local active
    active=$(tmux display-message -p -t "$pane" '#{pane_active}:#{window_active}' 2>/dev/null || true)
    [[ "$active" == "1:1" ]]
  }

  clear_target() {
    local pane="$1"
    local has_original
    local original_title
    local restore_title

    has_original=$(get_tmux_option "$pane" "@tmux_notice_has_original_title")
    original_title=$(get_tmux_option "$pane" "@tmux_notice_original_title")
    restore_title=$(get_tmux_option "$pane" "@tmux_notice_restore_title")

    if [[ "$has_original" == "1" && "$restore_title" == "1" ]]; then
      set_pane_title "$pane" "$original_title"
    fi

    set_tmux_option "$pane" "@tmux_notice_name" ""
    set_tmux_option "$pane" "@tmux_notice_icons" ""
    set_tmux_option "$pane" "@tmux_notice_session_notification_indicator_color" ""
    set_tmux_option "$pane" "@tmux_notice_session_indicator_color" ""
    set_tmux_option "$pane" "@tmux_notice_color" ""
    set_tmux_option "$pane" "@tmux_notice_original_title" ""
    set_tmux_option "$pane" "@tmux_notice_has_original_title" ""
    set_tmux_option "$pane" "@tmux_notice_restore_title" ""
    set_tmux_option "$pane" "@status_notice_icon" ""
    set_tmux_option "$pane" "@pane_notice_icon" ""
    set_tmux_option "$pane" "@pane_notice_title" ""
    set_tmux_option "$pane" "@pi_waiting" ""
  }

  resolve_tmux_target() {
    if [[ -n "$target" ]]; then
      printf '%s' "$target"
    elif [[ -n "''${TMUX_PANE:-}" ]]; then
      printf '%s' "$TMUX_PANE"
    fi
  }

  display_tmux_format() {
    local format="$1"
    local tmux_target
    tmux_target=$(resolve_tmux_target)

    if [[ -n "$tmux_target" ]]; then
      tmux display-message -p -t "$tmux_target" "$format" 2>/dev/null || true
    else
      tmux display-message -p "$format" 2>/dev/null || true
    fi
  }

  clear_panes() {
    local pane
    for pane in "$@"; do
      [[ -n "$pane" ]] || continue
      clear_target "$pane"
    done
    refresh_tmux_status
  }

  clear_window() {
    local window
    window=$(display_tmux_format '#{window_id}')
    [[ -n "$window" ]] || exit 0
    mapfile -t panes < <(tmux list-panes -t "$window" -F '#{pane_id}' 2>/dev/null || true)
    clear_panes "''${panes[@]}"
  }

  clear_session() {
    local session
    session=$(display_tmux_format '#{session_id}')
    [[ -n "$session" ]] || exit 0
    mapfile -t panes < <(tmux list-panes -s -t "$session" -F '#{pane_id}' 2>/dev/null || true)
    clear_panes "''${panes[@]}"
  }

  clear_all() {
    mapfile -t panes < <(tmux list-panes -a -F '#{pane_id}' 2>/dev/null || true)
    clear_panes "''${panes[@]}"
  }

  clear_notices() {
    local scope="window"
    local pane

    while [[ $# -gt 0 ]]; do
      case "$1" in
        --pane)
          scope="pane"
          ;;
        --window)
          scope="window"
          ;;
        --session)
          scope="session"
          ;;
        --all)
          scope="all"
          ;;
        *)
          echo "tmux-notice: unknown clear option: $1" >&2
          exit 2
          ;;
      esac
      shift
    done

    case "$scope" in
      pane)
        pane=$(resolve_target) || exit 0
        clear_panes "$pane"
        ;;
      window) clear_window ;;
      session) clear_session ;;
      all) clear_all ;;
    esac
  }

  notice_config() {
    local name="$1"
    jq -c --arg name "$name" '.notices[$name] // .fallback' "$config_file"
  }

  pad_right() {
    local value="$1"
    local width="$2"
    local length="''${#value}"

    printf '%s' "$value"
    if (( length < width )); then
      printf '%*s' $((width - length)) ""
    fi
  }

  print_list_row() {
    local name="$1"
    local title_mode="$2"
    local pane_title="$3"
    local color="$4"
    local strip_patterns="$5"
    local animation="$6"
    local strip_width="$7"

    pad_right "$name" 16
    printf '  '
    pad_right "$title_mode" 8
    printf '  '
    pad_right "$pane_title" 10
    printf '  '
    pad_right "$color" 7
    printf '  '
    pad_right "$strip_patterns" "$strip_width"
    printf '  %s\n' "$animation"
  }

  list_notices() {
    local rows=()
    local strip_width=5
    local strip_patterns

    while IFS= read -r row; do
      rows+=("$row")
      IFS=$'\t' read -r _name _title_mode _pane_title _color strip_patterns _animation <<<"$row"
      if (( ''${#strip_patterns} > strip_width )); then
        strip_width="''${#strip_patterns}"
      fi
    done < <(
      jq -r '
        def icon_label:
          if test("^ +$") then "(blank)" elif . == "" then "(empty)" else . end;
        def animation($notice):
          (($notice.icons // []) | map(icon_label) | join(" -> "));
        def strip_patterns($notice):
          (($notice.stripPatterns // []) | if length == 0 then "-" else map("/" + . + "/") | join(", ") end);
        def pane_title($notice):
          if ($notice.paneTitle.enable // false) then "set" else "unchanged" end;
        def session_notification_color($notice):
          ($notice.sessionNotificationIndicatorColor // "-");
        def row($name; $notice):
          [
            $name,
            ($notice.titleMode // "current"),
            pane_title($notice),
            session_notification_color($notice),
            strip_patterns($notice),
            animation($notice)
          ] | @tsv;

        (.notices | to_entries[] | row(.key; .value)),
        (row("<fallback>"; .fallback))
      ' "$config_file"
    )

    printf 'Usage: tmux-notice on <notice>\n\n'
    print_list_row "notice" "title" "paneTitle" "session" "strip" "animation" "$strip_width"
    print_list_row "----------------" "--------" "----------" "-------" "$(printf '%*s' "$strip_width" "" | tr " " "-")" "---------" "$strip_width"
    for row in "''${rows[@]}"; do
      IFS=$'\t' read -r name title_mode pane_title color strip_patterns animation <<<"$row"
      print_list_row "$name" "$title_mode" "$pane_title" "$color" "$strip_patterns" "$animation" "$strip_width"
    done
  }

  notice_title() {
    local notice_json="$1"
    local current_title="$2"
    local name="$3"
    jq -nr \
      --argjson notice "$notice_json" \
      --arg current "$current_title" \
      --arg name "$name" '
        def strip_patterns($s):
          reduce (($notice.stripPatterns // [])[]) as $pattern ($s; sub($pattern; ""));

        ($notice.titleMode // "current") as $mode
        | if $mode == "none" then
            ""
          elif $mode == "name" then
            strip_patterns($name)
          elif $mode == "notice" then
            strip_patterns(($notice.title // $name))
          else
            (strip_patterns($current) | if . == "" then strip_patterns(($notice.title // $name)) else . end)
          end
      '
  }

  render_template() {
    local template="$1"
    local icon="$2"
    local title="$3"
    local name="$4"
    local rendered="$template"
    rendered="''${rendered//\{icon\}/$icon}"
    rendered="''${rendered//\{title\}/$title}"
    rendered="''${rendered//\{name\}/$name}"
    printf '%s' "$rendered"
  }

  on_notice() {
    local name="$1"
    local pane
    pane=$(resolve_target) || exit 0

    if pane_is_visible_active "$pane"; then
      exit 0
    fi

    local notice_json
    local current_title
    local title
    local first_icon
    local icons
    local session_notification_indicator_color
    local pane_title_enabled
    local pane_title_template
    local pane_title_restore

    notice_json=$(notice_config "$name")
    current_title=$(get_pane_title "$pane")
    title=$(notice_title "$notice_json" "$current_title" "$name")
    first_icon=$(jq -r 'if ((.icons // []) | length) > 0 then .icons[0] else "•" end' <<<"$notice_json")
    icons=$(jq -r 'if ((.icons // []) | length) > 0 then .icons | join("|") else "•" end' <<<"$notice_json")
    session_notification_indicator_color=$(jq -r '.sessionNotificationIndicatorColor // ""' <<<"$notice_json")
    pane_title_enabled=$(jq -r '.paneTitle.enable // false' <<<"$notice_json")
    pane_title_template=$(jq -r '.paneTitle.template // "{icon} {title}"' <<<"$notice_json")
    pane_title_restore=$(jq -r '.paneTitle.restoreOnClear // true' <<<"$notice_json")

    if [[ "$(get_tmux_option "$pane" "@tmux_notice_has_original_title")" != "1" ]]; then
      set_tmux_option "$pane" "@tmux_notice_original_title" "$current_title"
      set_tmux_option "$pane" "@tmux_notice_has_original_title" "1"
    fi

    set_tmux_option "$pane" "@tmux_notice_name" "$name"
    set_tmux_option "$pane" "@tmux_notice_icons" "$icons"
    set_tmux_option "$pane" "@tmux_notice_session_notification_indicator_color" "$session_notification_indicator_color"
    set_tmux_option "$pane" "@tmux_notice_session_indicator_color" ""
    set_tmux_option "$pane" "@tmux_notice_color" ""
    set_tmux_option "$pane" "@status_notice_icon" "$first_icon"
    set_tmux_option "$pane" "@pane_notice_icon" "$first_icon"
    set_tmux_option "$pane" "@pane_notice_title" "$title"

    if [[ "$pane_title_enabled" == "true" ]]; then
      local rendered_title
      rendered_title=$(render_template "$pane_title_template" "$first_icon" "$title" "$name")
      set_pane_title "$pane" "$rendered_title"
      if [[ "$pane_title_restore" == "true" ]]; then
        set_tmux_option "$pane" "@tmux_notice_restore_title" "1"
      else
        set_tmux_option "$pane" "@tmux_notice_restore_title" ""
      fi
    fi

    refresh_tmux_status
  }

  off_notice() {
    local expected_name="''${1:-}"
    local pane
    pane=$(resolve_target) || exit 0

    if [[ -n "$expected_name" ]]; then
      local current_name
      current_name=$(get_tmux_option "$pane" "@tmux_notice_name")
      [[ "$current_name" == "$expected_name" ]] || exit 0
    fi

    clear_target "$pane"
    refresh_tmux_status
  }

  if [[ $# -lt 1 ]]; then
    usage >&2
    exit 2
  fi

  command="$1"
  shift

  parsed_args=()
  parse_target "$@"
  set -- "''${parsed_args[@]}"

  case "$command" in
    on)
      if [[ $# -lt 1 ]]; then
        echo "tmux-notice: missing notice name" >&2
        exit 2
      fi
      on_notice "$1"
      ;;
    off)
      off_notice "''${1:-}"
      ;;
    clear)
      clear_notices "$@"
      ;;
    list)
      list_notices
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "tmux-notice: unknown command: $command" >&2
      usage >&2
      exit 2
      ;;
  esac
''
