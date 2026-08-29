{ pkgs, lib, ... }:

{
  config = lib.mkIf pkgs.stdenv.hostPlatform.isDarwin {
    dot.home.file.".hammerspoon".source = "hammerspoon";
  };
}
