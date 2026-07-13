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
      ".." = "cd ..";
    };

    packages = with pkgs; [
      curl
      fd
      glow
      grpcurl
      jq
      ripgrep
      wget
    ];
  };

  dot = {
    xdg.configFile."wezterm/wezterm.lua".source = true;
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
    ./archive.nix
    ./atuin.nix
    ./aws.nix
    ./bat.nix
    ./bottom.nix
    ./carapace.nix
    ./claude.nix
    ./codex.nix
    ./delta.nix
    ./difftastic.nix
    ./docker.nix
    ./fzf.nix
    ./gcloud.nix
    ./gh.nix
    ./ghostty.nix
    ./ghq.nix
    ./git.nix
    ./go.nix
    ./hammerspoon.nix
    ./herdr.nix
    ./lazydocker.nix
    ./lazygit.nix
    ./make.nix
    ./mise.nix
    ./mycli.nix
    ./navi.nix
    ./neovim
    ./nix.nix
    ./javascript.nix
    ./nushell.nix
    ./pgcli.nix
    ./pi.nix
    ./python.nix
    ./scripts.nix
    ./starship.nix
    ./tm.nix
    ./tmux.nix
    ./visidata.nix
    ./zed.nix
    ./zsh.nix
  ];
}
