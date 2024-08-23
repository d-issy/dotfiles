{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.navi ];

    programs.zsh.initExtra = ''
      eval "$(${pkgs.navi}/bin/navi widget zsh)"
    '';

    xdg.configFile."navi" = {
      source = ../files/navi;
      recursive = true;
    };
  };
}
