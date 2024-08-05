{ config, pkgs, ... }:
{
  config = {
    home.packages = [
      pkgs.duckdb
      pkgs.eza
      pkgs.gh
      pkgs.jq
      pkgs.jqp
      pkgs.lazydocker
      pkgs.neovim
    ];
    programs = {
      direnv.enable = true;
      zoxide.enable = true;
    };
  };
}
