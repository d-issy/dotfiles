{
  pkgs,
  lib,
  dot,
  ...
}:

{
  config = lib.mkIf pkgs.stdenv.isDarwin {
    home.file.".hammerspoon" = {
      source = dot.files + "/hammerspoon";
      recursive = true;
    };
  };
}
