{ config, pkgs, lib, ... }:

{
  home.username = "issy";
  home.homeDirectory = "/home/issy";

  imports = [ ./modules/common.nix ];
}

