{ config, pkgs, ... }:
{
  config = {
    home.packages = [
      pkgs.gh
      pkgs.ghq
      pkgs.htop
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
