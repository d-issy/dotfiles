{ config, pkgs, ... }:

{
  config = {
    home.packages = [
      pkgs.neovim
      pkgs.tree-sitter
    ];
    home.sessionVariables = { EDITOR = "nvim"; };
    home.shellAliases = { v = "nvim"; };

    xdg.configFile."nvim" = {
      source = ../files/nvim;
      recursive = true;
    };
  };
}
