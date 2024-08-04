{ config, pkgs, lib, ... }:

let
  username = builtins.getEnv "USER";
  homeDirectory = builtins.getEnv "HOME";
in
{
  home.username = username;
  home.homeDirectory = homeDirectory;

  home.stateVersion = "24.11";
  xdg.enable = true;

  imports = [
    ./modules/git.nix
    ./modules/lazygit.nix
    ./modules/misc.nix
    ./modules/mise.nix
    ./modules/starship.nix
    ./modules/tmux.nix
    ./modules/zsh.nix
  ];

  programs.home-manager.enable = true;
}

