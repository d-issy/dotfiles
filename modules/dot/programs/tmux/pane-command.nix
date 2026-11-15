{ pkgs, ... }:

let
  # procps-ng ps on Linux; macOS keeps the system BSD ps (procps does not support these options there).
  ps = if pkgs.stdenv.hostPlatform.isLinux then "${pkgs.procps}/bin/ps" else "ps";
in
{
  # Print a pane's foreground command by argv[0] (kernel comm can be a version-named binary).
  command = pkgs.writeShellScriptBin "tmux-pane-cmd" ''
    tty=''${1#/dev/}
    [ -n "$tty" ] || exit 0
    fpgid=$(${ps} -t "$tty" -o tpgid= 2>/dev/null | ${pkgs.gawk}/bin/awk 'NR==1{gsub(/ /,"");print;exit}')
    case "$fpgid" in
      "" | *[!0-9]*) ;;
      *)
        argv0=$(${ps} -o command= -p "$fpgid" 2>/dev/null | ${pkgs.gawk}/bin/awk '{print $1; exit}')
        if [ -n "$argv0" ]; then
          name=''${argv0##*/}
          printf '%s' "''${name#-}"
          exit 0
        fi
        ;;
    esac
    ${ps} -o comm= -p "$fpgid" 2>/dev/null | ${pkgs.gawk}/bin/awk '{sub(/.*\//,"",$1); print $1; exit}'
  '';
}
