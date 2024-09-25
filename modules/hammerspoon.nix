{ config, pkgs, ... }:

{
  config = {
    home.file.".hammerspoon" = {
      source = ../files/hammerspoon;
      recursive = true;
    };
  };
}
