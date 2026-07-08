{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.fzf;
in
{
  options.dot.programs.fzf = {
    enable = lib.mkEnableOption "fzf";

    package = lib.mkPackageOption pkgs "fzf" { };

    defaultOptions = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
      description = "Options to set in FZF_DEFAULT_OPTS.";
      example = [
        "--reverse"
        "--border"
      ];
    };
  };

  config = lib.mkIf cfg.enable {
    home = {
      packages = [ cfg.package ];
      sessionVariables = lib.mkIf (cfg.defaultOptions != [ ]) {
        FZF_DEFAULT_OPTS = lib.concatStringsSep " " cfg.defaultOptions;
      };
    };

    dot.options.fuzzyFinder.package = lib.mkDefault cfg.package;
  };
}
