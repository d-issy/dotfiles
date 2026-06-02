{
  config,
  ...
}:

let
  cfg = config.dot.programs.tmux;
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;
in
{
  zsh = ''
    function ${cfg.sessionSelector.commandName}() {
      if ! ${cfg.package}/bin/tmux has-session 2>/dev/null; then
        ${cfg.package}/bin/tmux new-session -s ${cfg.sessionSelector.defaultSessionName} -c $HOME -d
      fi

      target=$(
        ${cfg.package}/bin/tmux list-sessions -F "#S" | ${fuzzyFinderCommand} \
          --header='Ctrl+C: new | Ctrl-D: delete' \
          --bind='ctrl-c:reload(zoxide query --list)' \
          --bind='ctrl-d:execute(${cfg.package}/bin/tmux kill-session -t {1})+reload(${cfg.package}/bin/tmux list-sessions -F "#S")'
      )

      if [ -z "$target" ]; then
        return
      fi

      if ! ${cfg.package}/bin/tmux has-session -t "$target" 2>/dev/null; then
        session_name=$(basename "$target")
        ${cfg.package}/bin/tmux new-session -s $session_name -c "$target" -d
        target="$session_name"
      fi

      if [ -z "$TMUX" ]; then
        ${cfg.package}/bin/tmux attach-session -t "$target"
      else
        ${cfg.package}/bin/tmux switch-client -t "$target"
      fi
    }
  '';

  nushell = ''
    export def ${cfg.sessionSelector.commandName} [] {
      if (${cfg.package}/bin/tmux has-session | complete | get exit_code | $in != 0) {
        ${cfg.package}/bin/tmux new-session -s ${cfg.sessionSelector.defaultSessionName} -c $env.HOME -d
      }

      mut target = (
        ${cfg.package}/bin/tmux list-sessions -F "#S" | ${fuzzyFinderCommand}
          --header='Ctrl+C: new | Ctrl-D: delete'
          --bind='ctrl-c:reload(zoxide query --list)'
          --bind='ctrl-d:execute(${cfg.package}/bin/tmux kill-session -t {1})+reload(${cfg.package}/bin/tmux list-sessions -F "#S")'
        | complete | get "stdout" | str trim
      )

      if ($target | is-empty) { return }
      if (${cfg.package}/bin/tmux has-session -t $target | complete | get exit_code | $in != 0) {
        let session_name = $target | path basename
        ${cfg.package}/bin/tmux new-session -s $session_name -c $target -d
        $target = $session_name
      }

      if ($env.TMUX | is-empty) {
        ${cfg.package}/bin/tmux attach-session -t $target
      } else {
        ${cfg.package}/bin/tmux switch-client -t $target
      }
    }
  '';
}
