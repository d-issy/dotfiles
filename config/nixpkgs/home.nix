{ config, pkgs, ... }:

let
  pkgs = import <nixpkgs> { };

in {
  programs.home-manager.enable = true;

  home.username = "issy";
  home.homeDirectory = "/home/issy";

  home.stateVersion = "21.11";
  home.packages = [
    # starship
    pkgs.starship

    # git
    pkgs.git
    pkgs.tig
    pkgs.gh

    # cli tools
    pkgs.tmux
    pkgs.zoxide

    # dev tools
    pkgs.awscli2
    pkgs.google-cloud-sdk
    pkgs.jq
    pkgs.fzf
    pkgs.ripgrep
  ];

  programs.starship = {
    enable = true;
    settings = {
      add_newline = false;
    };
  };

  programs.git = {
    enable = true;
    userName = "d-issy";
    userEmail = "12374694+d-issy@users.noreply.github.com";
    extraConfig = {
      init = {
        defaultBranch = "main";
      };
      color = {
        ui = "auto";
        diff = "true";
      };
      core = {
        editor = "vim";
      };
    };
  };

  programs.tmux = {
    enable = true;
    prefix = "C-q";
    keyMode = "vi";
    baseIndex = 1;
    clock24 = true;
    customPaneNavigationAndResize = true;
  };

}
