{ ... }:

{
  home.username = "issy";
  home.homeDirectory = "/Users/issy";

  targets.darwin.copyApps.enable = false;
  targets.darwin.linkApps.enable = false;

  imports = [ ../recipes ];
}
