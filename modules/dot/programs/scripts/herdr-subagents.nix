{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.herdrSubagents;

  unwrapped = pkgs.dotApps.herdr-subagents;

  herdrSubagents =
    pkgs.runCommand cfg.commandName
      {
        nativeBuildInputs = [ pkgs.makeWrapper ];
        meta.mainProgram = cfg.commandName;
      }
      ''
        makeWrapper ${unwrapped}/bin/herdr-subagents "$out/bin/${cfg.commandName}" \
          --set HERDR_SUBAGENTS_DEFAULT_HERDR ${cfg.herdrPackage}/bin/herdr \
          --prefix PATH : ${cfg.herdrPackage}/bin
      '';
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
