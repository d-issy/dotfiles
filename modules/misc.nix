{ config, pkgs, ... }:
{
  config = {
    home.packages = [
      pkgs.eza
      pkgs.gh
      pkgs.ghq
      pkgs.jq
      pkgs.lazydocker
      pkgs.ripgrep
    ];
    programs = {
      direnv.enable = true;
      zoxide.enable = true;
    };
  };
}
