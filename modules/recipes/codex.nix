{ pkgs, ... }:

let
  statusLineConfig = ''tui.status_line=["model-with-reasoning","current-dir","context-remaining","weekly-limit"]'';

  codexStatusline = pkgs.writeShellApplication {
    name = "codex-statusline";
    text = ''
      case "''${1-}" in
        "" | exec | e | review | resume | archive | delete | unarchive | fork | mcp | sandbox)
          exec codex --config '${statusLineConfig}' "$@"
          ;;
        debug)
          if [[ "''${2-}" == "prompt-input" ]]; then
            exec codex --config '${statusLineConfig}' "$@"
          fi
          exec codex "$@"
          ;;
        -h | --help | -V | --version | login | logout | plugin | mcp-server | app-server | remote-control | app | completion | update | doctor | apply | cloud | exec-server | features | help)
          exec codex "$@"
          ;;
        *)
          exec codex --config '${statusLineConfig}' "$@"
          ;;
      esac
    '';
  };
in
{
  home = {
    packages = [ codexStatusline ];
    shellAliases.codex = "codex-statusline";
  };

  home.file.".codex/hooks.json".text =
    builtins.toJSON {
      hooks.Stop = [
        {
          hooks = [
            {
              type = "command";
              command = "tmux-notice on codex-wait >/dev/null 2>&1 || true";
              timeout = 5;
            }
          ];
        }
      ];
    }
    + "\n";
}
