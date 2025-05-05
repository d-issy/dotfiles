{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.codex ];
    home.file.".codex" = {
      source = ../files/codex;
      recursive = true;
    };
  };
}
