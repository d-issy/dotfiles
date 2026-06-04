{
  config,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.tmux;
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;
  ghqCommand = "${config.dot.programs.ghq.package}/bin/ghq";
  selectorCommand = pkgs.writeShellScript "tmux-session-selector" ''
    set -u

    if ${cfg.package}/bin/tmux has-session 2>/dev/null; then
      target=$(
        ${cfg.package}/bin/tmux list-sessions -F '#S' 2>/dev/null \
          | ${fuzzyFinderCommand} \
            --header='Ctrl-C: repos  Ctrl-D: delete' \
            --bind="ctrl-c:reload(${ghqCommand} list -p 2>/dev/null || true)+change-header(Repos)" \
            --bind="ctrl-d:execute(${cfg.package}/bin/tmux kill-session -t {1})+reload(${cfg.package}/bin/tmux list-sessions -F '#S' 2>/dev/null || true)"
      )
    else
      target=$(
        ${ghqCommand} list -p 2>/dev/null \
          | ${fuzzyFinderCommand} --header='Repos'
      )
    fi

    if [ -z "$target" ]; then
      exit 0
    fi

    if ! ${cfg.package}/bin/tmux has-session -t "$target" 2>/dev/null; then
      session_name=$(basename "$target")
      if ${cfg.package}/bin/tmux has-session -t "$session_name" 2>/dev/null; then
        target="$session_name"
      else
        ${cfg.package}/bin/tmux new-session -s "$session_name" -c "$target" -d
        target="$session_name"
      fi
    fi

    if [ -z "''${TMUX-}" ]; then
      ${cfg.package}/bin/tmux attach-session -t "$target"
    else
      ${cfg.package}/bin/tmux switch-client -t "$target"
    fi
  '';
in
{
  zsh = ''
    function ${cfg.sessionSelector.commandName}() {
      ${selectorCommand}
    }
  '';

  nushell = ''
    export def ${cfg.sessionSelector.commandName} [] {
      ^${selectorCommand}
    }
  '';
}
