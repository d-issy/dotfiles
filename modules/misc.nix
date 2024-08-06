{ config, pkgs, ... }:
{
  config = {
    home.packages = [
      pkgs.duckdb
      pkgs.eza
      pkgs.gh
      pkgs.ripgrep
      pkgs.jq
      pkgs.jqp
      pkgs.lazydocker
    ];
    programs = {
      direnv.enable = true;
      zoxide.enable = true;
    };
  };
}
