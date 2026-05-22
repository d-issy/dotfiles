{
  pkgs,
  lib,
  dotfiles,
  ...
}:

{
  config = lib.mkIf pkgs.stdenv.isDarwin {
    home.file.".hammerspoon" = {
      source = (dotfiles.files + "/hammerspoon");
      recursive = true;
    };
  };
}
