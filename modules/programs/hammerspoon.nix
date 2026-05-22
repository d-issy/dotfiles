{ pkgs, lib, ... }:

{
  config = lib.mkIf pkgs.stdenv.isDarwin {
    home.file.".hammerspoon" = {
      source = ../../files/hammerspoon;
      recursive = true;
    };
  };
}
