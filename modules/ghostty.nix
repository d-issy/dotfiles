{ config, pkgs, ... }:

{
  xdg.configFile."ghostty/config".source = ../files/ghostty/config;
}