{ config, pkgs, ... }:

{
  home.username = "issy";
  home.homeDirectory =
    if pkgs.stdenv.isDarwin
    then "/Users/issy" # for linux
    else "/home/issy"; # for macOS

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
