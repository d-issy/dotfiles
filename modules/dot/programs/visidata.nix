{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.visidata;
in
{
  options.dot.programs.visidata = {
    enable = lib.mkEnableOption "visidata";

    package = lib.mkPackageOption pkgs "visidata" { };
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ];
  };
}
