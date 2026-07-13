{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.mycli;
in
{
  options.dot.programs.mycli = {
    enable = lib.mkEnableOption "mycli";

    package = lib.mkPackageOption pkgs "mycli" { };
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ];
  };
}
