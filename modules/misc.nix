{ config, pkgs, ... }:
{
  config = {
    home.packages = [
      pkgs.devbox
      pkgs.ghq
      pkgs.htop
      pkgs.jq
      pkgs.ripgrep
    ];
    programs = {
      direnv.enable = true;
      zoxide.enable = true;
    };
  };
}
