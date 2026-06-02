{ config, pkgs, ... }:

{
  xdg.enable = true;
  home = {
    stateVersion = "26.05";

    sessionVariables = {
      NIX_CONFIG = "extra-experimental-features = nix-command flakes";
    };

    sessionPath = [
      "${config.home.homeDirectory}/.local/bin"
    ];

    shellAliases = {
      ".." = "cd..";
      dc = "docker compose";
    };

    packages = with pkgs; [
      curl
      fd
      glow
      gnumake
      google-cloud-sdk
      grpcurl
      jq
      ripgrep
      wget
    ];
  };

  dot = {
    xdg.configFile."wezterm/wezterm.lua".source = true;
    home.file = {
      ".pi/agent".source = "pi/agent";
      ".local/bin".source = "scripts";
    };
  };

  programs = {
    home-manager.enable = true;
    zoxide.enable = true;
    direnv = {
      enable = true;
      nix-direnv.enable = true;
      enableZshIntegration = true;
      enableNushellIntegration = true;
    };
  };

  imports = [
    ./agent-skills.nix
    ./atuin.nix
    ./aws.nix
    ./bat.nix
    ./bottom.nix
    ./carapace.nix
    ./claude.nix
    ./delta.nix
    ./difftastic.nix
    ./fzf.nix
    ./gh.nix
    ./ghostty.nix
    ./ghq.nix
    ./git.nix
    ./hammerspoon.nix
    ./lazydocker.nix
    ./lazygit.nix
    ./navi.nix
    ./neovim
    ./node.nix
    ./nushell.nix
    ./starship.nix
    ./tmux.nix
    ./worktrunk.nix
    ./zed.nix
    ./zsh.nix
  ];
}
