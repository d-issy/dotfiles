{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.neovim ];
    home.sessionVariables = { EDITOR = "nvim"; };
    home.shellAliases = { v = "nvim"; };

    xdg.configFile."nvim" = {
      source = ../files/nvim;
      recursive = true;
    };
  };
}
