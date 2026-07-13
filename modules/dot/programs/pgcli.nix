{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.pgcli;
in
{
  options.dot.programs.pgcli = {
    enable = lib.mkEnableOption "pgcli";

    package = lib.mkPackageOption pkgs "pgcli" { };
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ];
  };
}
