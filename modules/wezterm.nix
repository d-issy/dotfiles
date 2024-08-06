{ config, pkgs, ... }:

{
  xdg.configFile."wezterm/wezterm.lua".source = ../files/wezterm/wezterm.lua;
}
