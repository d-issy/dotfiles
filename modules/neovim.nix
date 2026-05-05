{ pkgs, ... }:

{
  config = {
    home = {
      packages = [
        pkgs.neovim
        pkgs.tree-sitter
      ];
      sessionVariables = {
        EDITOR = "nvim";
      };
      shellAliases = {
        v = "nvim";
      };
    };

    xdg.configFile."nvim" = {
      source = ../files/nvim;
      recursive = true;
    };
  };
}
