{ pkgs, ... }:

let
  codexStatusline = pkgs.writeShellApplication {
    name = "codex-statusline";
    text = ''
      case "''${1-}" in
        "" | exec | e | review | resume | archive | delete | unarchive | fork | mcp | sandbox)
          exec codex --profile statusline "$@"
          ;;
        debug)
          if [[ "''${2-}" == "prompt-input" ]]; then
            exec codex --profile statusline "$@"
          fi
          exec codex "$@"
          ;;
        -h | --help | -V | --version | login | logout | plugin | mcp-server | app-server | remote-control | app | completion | update | doctor | apply | cloud | exec-server | features | help)
          exec codex "$@"
          ;;
        *)
          exec codex --profile statusline "$@"
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

  dot.home.file.".codex/statusline.config.toml".source = "codex/statusline.config.toml";

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
