{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.neovim ];
    home.sessionVariables = {
      EDITOR = "nvim";
    };

    programs.zsh.shellAliases = {
      v = "nvim";
    };

    xdg.configFile."nvim" = {
      source = ../files/nvim;
      recursive = true;
    };
  };
}
