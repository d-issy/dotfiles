{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.codex;

  flattenSettings =
    path: settings:
    lib.concatMap (
      name:
      let
        value = settings.${name};
        key = lib.concatStringsSep "." (path ++ [ name ]);
      in
      if builtins.isAttrs value then
        flattenSettings (path ++ [ name ]) value
      else
        [ "${key}=${builtins.toJSON value}" ]
    ) (lib.attrNames settings);

  configArgs = lib.concatMapStringsSep " " (setting: "--config ${lib.escapeShellArg setting}") (
    flattenSettings [ ] cfg.settings
  );

  codexWrapper = pkgs.writeShellApplication {
    name = "codex-statusline";
    text = ''
      case "''${1-}" in
        "" | exec | e | review | resume | archive | delete | unarchive | fork | mcp | sandbox)
          exec ${cfg.command} ${configArgs} "$@"
          ;;
        debug)
          if [[ "''${2-}" == "prompt-input" ]]; then
            exec ${cfg.command} ${configArgs} "$@"
          fi
          exec ${cfg.command} "$@"
          ;;
        -h | --help | -V | --version | login | logout | plugin | mcp-server | app-server | remote-control | app | completion | update | doctor | apply | cloud | exec-server | features | help)
          exec ${cfg.command} "$@"
          ;;
        *)
          exec ${cfg.command} ${configArgs} "$@"
          ;;
      esac
    '';
  };
in
{
  options.dot.programs.codex = {
    enable = lib.mkEnableOption "Codex";

    command = lib.mkOption {
      type = lib.types.str;
      default = "codex";
      description = "Codex command invoked by the wrapper.";
    };

    settings = lib.mkOption {
      type = lib.types.attrs;
      default = { };
      description = "Codex settings passed as command-line configuration overrides.";
      example = {
        agents.max_concurrent_threads_per_session = 8;
      };
    };

    hooks = lib.mkOption {
      type = lib.types.attrs;
      default = { };
      description = "Codex hooks written to .codex/hooks.json.";
    };
  };

  config = lib.mkIf cfg.enable {
    home = {
      packages = [ codexWrapper ];
      shellAliases.codex = "codex-statusline";
    };

    home.file.".codex/hooks.json" = lib.mkIf (cfg.hooks != { }) {
      text = builtins.toJSON { inherit (cfg) hooks; } + "\n";
    };
  };
}
