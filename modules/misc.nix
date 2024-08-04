{ config, pkgs, ... }:
{
  config = {
    home.packages = [
      pkgs.chezmoi
      pkgs.duckdb
      pkgs.eza
      pkgs.fzf
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
