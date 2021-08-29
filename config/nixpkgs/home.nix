{ config, pkgs, ... }:

let
  pkgs = import <nixpkgs> { };

in {
  programs.home-manager.enable = true;

  home.username = "issy";
  home.homeDirectory = "/home/issy";

  home.stateVersion = "21.11";
  home.packages = [

    # zsh
    pkgs.zsh
    pkgs.zsh-syntax-highlighting

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

  programs.zsh = {
    enable = true;
    enableSyntaxHighlighting = true;
    shellAliases = {
      ll = "ls -la";
      ts = "tig status";
    };
    envExtra = ''
if [ -e $HOME/.config ]; then
	export XDG_CONFIG_HOME=$HOME/.config
fi

if [ -e $HOME/.config/zsh ]; then
	export ZDOTDIR=$XDG_CONFIG_HOME/zsh
fi

if [ -e $HOME/.nix-profile/etc/profile.d/nix.sh ]; then
	. $HOME/.nix-profile/etc/profile.d/nix.sh
fi
    '';
  };

  programs.starship = {
    enable = true;
    settings = {
      add_newline = false;
      format = ''
[┌─](bold)$time $memory_usage$cmd_duration$git_branch$git_commit$git_state$git_status
[│](bold) $status$directory
[└─](bold)$character
      '';
      character = {
        success_symbol = "[>](bold)";
        error_symbol = ">(bold)";
        vicmd_symbol = "|(bold)";
      };
      status = {
        disabled = false;
        format   = "[ $symbol$status ]($style) ";
        symbol   = " ";
        style    = "RED BOLD";
      };
      time = {
        disabled    = false;
        time_format = "%Y-%m-%dT%H:%M:%S";
        format      = "[$time]($style)";
      };
      cmd_duration = {
        disabled = false;
        format   = "[ $duration]($style) ";
        min_time = 1000;
      };
      directory = {
        truncation_length = 10;
      };
      git_branch = {
        always_show_remote = true;
        format = "on [$symbol $branch]($style) ";
        style  = "fg:214";
        symbol = "";
      };
      git_status = {
        format = "[$all_status$ahead$behind]($style)";
        style  = "";

        deleted   = "[ $count ](red bold)";
        renamed   = "[ $count ](green bold)";
        modified  = "[ $count ](yellow bold)";
        staged    = "[ $count ](green bold)";
        untracked = "[ $count ](fg:8 bold)";
        ahead     = "↑ $count ";
        behind    = "↓ $count ";
      };
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

  programs.zoxide = {
    enable = true;
  };

}
