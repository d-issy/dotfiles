{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.options.fuzzyFinder;
in
{
  options.dot.options.fuzzyFinder = {
    package = lib.mkOption {
      type = lib.types.nullOr lib.types.package;
      default = null;
      description = "Fuzzy finder package used by dot modules. When null, command must be set explicitly.";
    };

    bin = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Executable name under dot.options.fuzzyFinder.package/bin. When null, lib.getExe is used.";
      example = "fzf";
    };

    command = lib.mkOption {
      type = lib.types.str;
      description = "Fuzzy finder command used by dot modules.";
      example = "${pkgs.fzf}/bin/fzf";
    };
  };

  config.dot.options.fuzzyFinder.command = lib.mkIf (cfg.package != null) (
    lib.mkDefault (if cfg.bin == null then lib.getExe cfg.package else "${cfg.package}/bin/${cfg.bin}")
  );
}
