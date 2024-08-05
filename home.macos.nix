{ config, pkgs, lib, ... }:

{
  home.username = "issy";
  home.homeDirectory = "/Users/issy";

  imports = [ ./modules/common.nix ];
}

