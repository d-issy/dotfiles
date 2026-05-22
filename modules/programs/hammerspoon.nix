{
  pkgs,
  lib,
  ...
}:

{
  config = lib.mkIf pkgs.stdenv.isDarwin {
    dot.home.file.".hammerspoon".source = "hammerspoon";
  };
}
