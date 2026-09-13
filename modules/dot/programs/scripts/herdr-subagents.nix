{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.herdrSubagents;

  herdrSubagents = pkgs.writeShellApplication {
    name = cfg.commandName;
    runtimeInputs = [
      pkgs.coreutils
      pkgs.gawk
      pkgs.jq
      cfg.herdrPackage
    ];
    text = ''
      herdr="''${HERDR_BIN_PATH:-${cfg.herdrPackage}/bin/herdr}"

      usage() {
        cat <<'EOF'
      Usage:
        herdr-subagents start NAME=PRESET [NAME=PRESET ...]
        herdr-subagents status
        herdr-subagents cleanup [--force]

      Presets:
        pi  sol  sol-high  terra  luna  opus  fable  fable-high  grok  composer

      Split the current Pi pane in half and manage equally sized Herdr subagent panes.
      EOF
      }

      die() {
        printf 'herdr-subagents: %s\n' "$*" >&2
        exit 1
      }

      require_context() {
        [ "''${HERDR_ENV:-}" = 1 ] || die "must run inside Herdr"
        [ -n "''${HERDR_SOCKET_PATH:-}" ] || die "HERDR_SOCKET_PATH is not set"
        [ -n "''${HERDR_WORKSPACE_ID:-}" ] || die "HERDR_WORKSPACE_ID is not set"
        [ -n "''${HERDR_TAB_ID:-}" ] || die "HERDR_TAB_ID is not set"
        [ -n "''${HERDR_PANE_ID:-}" ] || die "HERDR_PANE_ID is not set"
      }

      init_manifest_path() {
        local runtime_root session_key context_key
        runtime_root="''${XDG_RUNTIME_DIR:-''${TMPDIR:-/tmp}}/herdr-subagents"
        session_key="$(printf '%s' "$HERDR_SOCKET_PATH" | sha256sum | cut -c1-16)"
        context_key="$(printf '%s' "$HERDR_WORKSPACE_ID:$HERDR_TAB_ID:$HERDR_PANE_ID" | sha256sum | cut -c1-16)"
        state_dir="$runtime_root/$session_key"
        manifest="$state_dir/$context_key.json"
      }

      require_manifest() {
        [ -f "$manifest" ] || die "no subagent manifest exists for the current pane"
        jq -e \
          --arg workspace "$HERDR_WORKSPACE_ID" \
          --arg tab "$HERDR_TAB_ID" \
          --arg main "$HERDR_PANE_ID" \
          '.workspace_id == $workspace and .tab_id == $tab and .main_pane_id == $main' \
          "$manifest" >/dev/null \
          || die "manifest does not belong to the current Herdr context"
      }

      write_manifest() {
        local next="$manifest.tmp"
        umask 077
        mkdir -p "$state_dir"
        cat > "$next"
        mv "$next" "$manifest"
      }

      show_status() {
        local panes
        require_manifest
        panes="$("$herdr" pane list --workspace "$HERDR_WORKSPACE_ID")"
        jq \
          --argjson panes "$panes" \
          '.agents |= map(
            . as $agent
            | ([ $panes.result.panes[]
                | select(.pane_id == $agent.pane_id and .tab_id == $agent.tab_id) ][0] // null) as $pane
            | . + {
                present: ($pane != null),
                status: (if $pane == null then "exited" else ($pane.agent_status // "unknown") end)
              }
          )' "$manifest"
      }

      codex_catalog=
      cursor_catalog=

      latest_codex_model() {
        local family="$1"
        command -v codex >/dev/null || die "codex is required for the $family preset"
        if [ -z "$codex_catalog" ]; then
          codex_catalog="$(codex debug models)" || die "failed to load the Codex model catalog"
        fi
        latest_model="$(
          printf '%s' "$codex_catalog" \
            | jq -r --arg suffix "-$family" '.models[].slug | select(endswith($suffix))' \
            | sort -V \
            | tail -n 1
        )"
        [ -n "$latest_model" ] || die "no current Codex $family model is available"
      }

      latest_cursor_model() {
        local family="$1"
        command -v cursor-agent >/dev/null || die "cursor-agent is required for the $family preset"
        if [ -z "$cursor_catalog" ]; then
          cursor_catalog="$(cursor-agent --list-models)" || die "failed to load the Cursor model catalog"
        fi
        case "$family" in
          grok)
            latest_model="$(
              printf '%s' "$cursor_catalog" \
                | awk '$1 ~ /^cursor-grok-[0-9]+([.][0-9]+)*-high-fast$/ { print $1 }' \
                | sort -V \
                | tail -n 1
            )"
            ;;
          composer)
            latest_model="$(
              printf '%s' "$cursor_catalog" \
                | awk '$1 ~ /^composer-[0-9]+([.][0-9]+)*$/ { print $1 }' \
                | sort -V \
                | tail -n 1
            )"
            ;;
        esac
        [ -n "$latest_model" ] || die "no current Cursor $family model is available"
      }

      resolve_preset() {
        local preset="$1" latest_model
        resolved_effort=
        case "$preset" in
          pi)
            resolved_kind=pi
            resolved_model=
            ;;
          sol)
            resolved_kind=codex
            latest_codex_model sol
            resolved_model="$latest_model"
            resolved_effort=medium
            ;;
          sol-high)
            resolved_kind=codex
            latest_codex_model sol
            resolved_model="$latest_model"
            resolved_effort=high
            ;;
          terra)
            resolved_kind=codex
            latest_codex_model terra
            resolved_model="$latest_model"
            resolved_effort=high
            ;;
          luna)
            resolved_kind=codex
            latest_codex_model luna
            resolved_model="$latest_model"
            resolved_effort=xhigh
            ;;
          opus)
            resolved_kind=claude
            resolved_model=opus
            resolved_effort=high
            ;;
          fable)
            resolved_kind=claude
            resolved_model=fable
            resolved_effort=medium
            ;;
          fable-high)
            resolved_kind=claude
            resolved_model=fable
            resolved_effort=high
            ;;
          grok)
            resolved_kind=cursor
            latest_cursor_model grok
            resolved_model="$latest_model"
            ;;
          composer)
            resolved_kind=cursor
            latest_cursor_model composer
            resolved_model="$latest_model"
            ;;
          *)
            die "unknown preset: $preset"
            ;;
        esac
      }

      start_agents() {
        [ "$#" -gt 0 ] || die "start requires at least one NAME=PRESET argument"
        [ "$#" -le 10 ] || die "at most 10 subagents are supported"
        [ ! -e "$manifest" ] || die "a subagent manifest already exists; run cleanup first"

        local current layout current_agent pane_width pane_height main_direction agent_direction
        current="$("$herdr" pane current --current)"
        current_agent="$(printf '%s' "$current" | jq -r '.result.pane.agent // ""')"
        [ "$current_agent" = pi ] || die "the current pane must be running Pi"

        layout="$("$herdr" pane layout --current)"
        pane_width="$(printf '%s' "$layout" | jq -er --arg pane "$HERDR_PANE_ID" '.result.layout.panes[] | select(.pane_id == $pane) | .rect.width | select(. > 0)')"
        pane_height="$(printf '%s' "$layout" | jq -er --arg pane "$HERDR_PANE_ID" '.result.layout.panes[] | select(.pane_id == $pane) | .rect.height | select(. > 0)')"
        # Approximate terminal cells as twice as tall as they are wide.
        # Split the longer visual axis, then divide the agent half perpendicularly.
        if [ "$pane_width" -ge "$((pane_height * 2))" ]; then
          main_direction=right
          agent_direction=down
        else
          main_direction=down
          agent_direction=right
        fi

        local -a names=() presets=() kinds=() models=() efforts=() panes=() created=()
        local spec name preset existing resolved_kind resolved_model resolved_effort
        for spec in "$@"; do
          [[ "$spec" == *=* ]] || die "invalid agent specification: $spec (expected NAME=PRESET)"
          name="''${spec%%=*}"
          preset="''${spec#*=}"
          [[ "$name" =~ ^[a-z][a-z0-9_-]{0,31}$ ]] || die "invalid agent name: $name"
          for existing in "''${names[@]-}"; do
            [ "$existing" != "$name" ] || die "duplicate agent name: $name"
          done
          resolve_preset "$preset"
          names+=("$name")
          presets+=("$preset")
          kinds+=("$resolved_kind")
          models+=("$resolved_model")
          efforts+=("$resolved_effort")
        done

        rollback_layout() {
          local index
          for ((index=''${#created[@]} - 1; index >= 0; index--)); do
            "$herdr" pane close "''${created[$index]}" >/dev/null 2>&1 || true
          done
        }
        trap rollback_layout ERR
        trap 'rollback_layout; exit 130' INT
        trap 'rollback_layout; exit 143' TERM

        local split_result remaining_pane new_pane ratio index total
        total="''${#names[@]}"
        split_result="$("$herdr" pane split --pane "$HERDR_PANE_ID" --direction "$main_direction" --ratio 0.5 --cwd "$PWD" --no-focus)"
        remaining_pane="$(printf '%s' "$split_result" | jq -er '.result.pane.pane_id')"
        panes+=("$remaining_pane")
        created+=("$remaining_pane")

        for ((index=1; index < total; index++)); do
          ratio="$(awk -v remaining="$((total - index + 1))" 'BEGIN { printf "%.9f", 1 / remaining }')"
          split_result="$("$herdr" pane split --pane "$remaining_pane" --direction "$agent_direction" --ratio "$ratio" --cwd "$PWD" --no-focus)"
          new_pane="$(printf '%s' "$split_result" | jq -er '.result.pane.pane_id')"
          panes+=("$new_pane")
          created+=("$new_pane")
          remaining_pane="$new_pane"
        done

        local agents_json
        agents_json='[]'
        for ((index=0; index < total; index++)); do
          agents_json="$(
            jq -cn \
              --argjson agents "$agents_json" \
              --arg name "''${names[$index]}" \
              --arg preset "''${presets[$index]}" \
              --arg kind "''${kinds[$index]}" \
              --arg model "''${models[$index]}" \
              --arg effort "''${efforts[$index]}" \
              --arg pane "''${panes[$index]}" \
              --arg tab "$HERDR_TAB_ID" \
              '$agents + [{
                name: $name,
                preset: $preset,
                kind: $kind,
                model: $model,
                effort: (if $effort == "" then null else $effort end),
                pane_id: $pane,
                tab_id: $tab,
                started: false
              }]'
          )"
        done

        jq -n \
          --arg workspace "$HERDR_WORKSPACE_ID" \
          --arg tab "$HERDR_TAB_ID" \
          --arg main "$HERDR_PANE_ID" \
          --arg cwd "$PWD" \
          --argjson agents "$agents_json" \
          '{
            version: 2,
            state: "starting",
            workspace_id: $workspace,
            tab_id: $tab,
            main_pane_id: $main,
            cwd: $cwd,
            agents: $agents
          }' | write_manifest

        trap - ERR INT TERM

        start_agent_once() {
          local index="$1"
          case "''${kinds[$index]}" in
            pi)
              "$herdr" agent start "''${names[$index]}" \
                --kind pi \
                --pane "''${panes[$index]}"
              ;;
            claude)
              "$herdr" agent start "''${names[$index]}" \
                --kind claude \
                --pane "''${panes[$index]}" \
                -- \
                --model "''${models[$index]}" \
                --effort "''${efforts[$index]}"
              ;;
            codex)
              "$herdr" agent start "''${names[$index]}" \
                --kind codex \
                --pane "''${panes[$index]}" \
                -- \
                --model "''${models[$index]}" \
                --config "model_reasoning_effort=\"''${efforts[$index]}\""
              ;;
            cursor)
              "$herdr" agent start "''${names[$index]}" \
                --kind cursor \
                --pane "''${panes[$index]}" \
                -- \
                --model "''${models[$index]}"
              ;;
          esac
        }

        start_agent_with_retry() {
          local index="$1" start_output start_code
          # Each pane independently waits for its shell/direnv to become ready.
          for _ in $(seq 1 150); do
            if start_output="$(start_agent_once "$index" 2>&1)"; then
              return 0
            fi
            start_code="$(printf '%s' "$start_output" | jq -r '.error.code // ""' 2>/dev/null || true)"
            [ "$start_code" = "agent_pane_busy" ] || break
            sleep 0.2
          done
          printf 'herdr-subagents: failed to start %s: %s\n' \
            "''${names[$index]}" "$start_output" >&2
          return 1
        }

        local start_failed=false
        local -a start_pids=()
        for ((index=0; index < total; index++)); do
          start_agent_with_retry "$index" &
          start_pids+=("$!")
        done

        # Only the parent writes the manifest; collect every worker even on failure.
        for ((index=0; index < total; index++)); do
          if wait "''${start_pids[$index]}"; then
            jq --arg name "''${names[$index]}" \
              '(.agents[] | select(.name == $name) | .started) = true' \
              "$manifest" | write_manifest
          else
            start_failed=true
          fi
        done

        if "$start_failed"; then
          jq '.state = "partial"' "$manifest" | write_manifest
          show_status
          die "one or more agents failed to start; panes were preserved"
        fi

        jq '.state = "awaiting_readiness_check"' "$manifest" | write_manifest
        show_status
      }

      cleanup_agents() {
        local force=false
        if [ "''${1:-}" = --force ]; then
          force=true
          shift
        fi
        [ "$#" -eq 0 ] || die "cleanup accepts only --force"
        require_manifest

        local panes agent_count index pane_id name pane agent_name status started preserve_reason
        local closed_json preserved_json close_error
        panes="$("$herdr" pane list --workspace "$HERDR_WORKSPACE_ID")"
        agent_count="$(jq '.agents | length' "$manifest")"
        closed_json='[]'
        preserved_json='[]'

        for ((index=0; index < agent_count; index++)); do
          pane_id="$(jq -r ".agents[$index].pane_id" "$manifest")"
          name="$(jq -r ".agents[$index].name" "$manifest")"
          pane="$(printf '%s' "$panes" | jq -c --arg pane "$pane_id" --arg tab "$HERDR_TAB_ID" '[.result.panes[] | select(.pane_id == $pane and .tab_id == $tab)][0] // null')"

          if [ "$pane" = null ]; then
            closed_json="$(jq -cn --argjson items "$closed_json" --arg pane "$pane_id" '$items + [$pane]')"
            continue
          fi

          agent_name="$(printf '%s' "$pane" | jq -r '.agent // ""')"
          status="$(printf '%s' "$pane" | jq -r '.agent_status // "unknown"')"
          started="$(jq -r ".agents[$index].started" "$manifest")"
          preserve_reason=
          if [ "$started" != true ]; then
            preserve_reason=start_failed
          elif [ -n "$agent_name" ] && [ "$status" != "idle" ] && [ "$status" != "done" ]; then
            preserve_reason="agent_$status"
          fi
          if ! "$force" && [ -n "$preserve_reason" ]; then
            preserved_json="$(
              jq -cn \
                --argjson items "$preserved_json" \
                --arg name "$name" \
                --arg pane "$pane_id" \
                --arg reason "$preserve_reason" \
                '$items + [{name: $name, pane_id: $pane, reason: $reason}]'
            )"
            continue
          fi

          close_error=
          if close_error="$("$herdr" pane close "$pane_id" 2>&1)"; then
            closed_json="$(jq -cn --argjson items "$closed_json" --arg pane "$pane_id" '$items + [$pane]')"
          else
            preserved_json="$(
              jq -cn \
                --argjson items "$preserved_json" \
                --arg name "$name" \
                --arg pane "$pane_id" \
                --arg reason "close_failed" \
                '$items + [{name: $name, pane_id: $pane, reason: $reason}]'
            )"
            printf 'herdr-subagents: failed to close %s: %s\n' "$pane_id" "$close_error" >&2
          fi
        done

        jq -n --argjson closed "$closed_json" --argjson preserved "$preserved_json" \
          '{closed: $closed, preserved: $preserved}'

        if [ "$(printf '%s' "$preserved_json" | jq 'length')" -eq 0 ]; then
          rm -f "$manifest"
          rmdir "$state_dir" 2>/dev/null || true
        else
          return 1
        fi
      }

      require_context
      init_manifest_path

      command="''${1:-}"
      [ -n "$command" ] || {
        usage
        exit 2
      }
      shift

      case "$command" in
        start)
          start_agents "$@"
          ;;
        status)
          [ "$#" -eq 0 ] || die "status does not accept arguments"
          show_status
          ;;
        cleanup)
          cleanup_agents "$@"
          ;;
        -h | --help | help)
          usage
          ;;
        *)
          usage >&2
          exit 2
          ;;
      esac
    '';
  };
in
{
  options.dot.programs.scripts.herdrSubagents = {
    enable = lib.mkEnableOption "Herdr subagent layout manager";

    commandName = lib.mkOption {
      type = lib.types.str;
      default = "herdr-subagents";
      description = "Command name for managing Herdr subagent panes.";
    };

    herdrPackage = lib.mkOption {
      type = lib.types.package;
      default = config.dot.programs.herdr.package;
      defaultText = lib.literalExpression "config.dot.programs.herdr.package";
      description = "Herdr package used by herdr-subagents.";
    };

    package = lib.mkOption {
      type = lib.types.package;
      readOnly = true;
      default = herdrSubagents;
      description = "Generated herdr-subagents package.";
    };
  };

  config = lib.mkIf (config.dot.programs.scripts.enable && cfg.enable) {
    home.packages = [ cfg.package ];
  };
}
