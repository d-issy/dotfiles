{ config, pkgs, ... }:

{
  config = {
    programs.eza = {
      enable = true;
      git = true;
      icons = true;
    };
  };
}
