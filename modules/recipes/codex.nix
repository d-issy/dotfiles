{
  config,
  lib,
  pkgs,
  ...
}:

let
  tmuxNotice = config.dot.programs.scripts.tmuxNotice.package;
  codexNotify = pkgs.writeShellScript "codex-tmux-notice-notify" ''
    set -euo pipefail

    payload=$(cat || true)

    ${tmuxNotice}/bin/tmux-notice on codex-wait >/dev/null 2>&1 || true

    sky_client="$HOME/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
    if [[ -x "$sky_client" ]]; then
      printf '%s' "$payload" | "$sky_client" "$@" >/dev/null 2>&1 || true
    fi
  '';
  notifyLine = ''notify = ["${codexNotify}", "turn-ended"]'';
in
{
  config.home.activation.codexNotify = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    codex_config="$HOME/.codex/config.toml"
    notify_line=${lib.escapeShellArg notifyLine}

    mkdir -p "$(dirname "$codex_config")"
    if [[ ! -e "$codex_config" ]]; then
      printf '%s\n' "$notify_line" > "$codex_config"
    elif grep -Eq '^[[:space:]]*notify[[:space:]]*=' "$codex_config"; then
      tmp_file=$(mktemp)
      NOTIFY_LINE="$notify_line" ${pkgs.perl}/bin/perl -0pe 's/^[[:space:]]*notify[[:space:]]*=.*$/$ENV{NOTIFY_LINE}/m' \
        "$codex_config" > "$tmp_file"
      mv "$tmp_file" "$codex_config"
    else
      tmp_file=$(mktemp)
      {
        printf '%s\n\n' "$notify_line"
        cat "$codex_config"
      } > "$tmp_file"
      mv "$tmp_file" "$codex_config"
    fi
  '';
}
