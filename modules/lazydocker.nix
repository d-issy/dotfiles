{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.lazydocker ];
    home.shellAliases = { ld = "lazydocker"; };
  };
}
