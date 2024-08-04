{ config, pkgs, ... }:
{
  config = {
    home.packages = [
      pkgs.chezmoi
      pkgs.duckdb
      pkgs.eza
      pkgs.fzf
      pkgs.jq
      pkgs.jqp
      pkgs.neovim
    ];
    programs = {
      direnv.enable = true;
      zoxide.enable = true;
    };
  };
}
