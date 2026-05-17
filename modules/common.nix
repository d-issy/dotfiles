{ config, ... }:

{
  home.stateVersion = "24.11";

  home.sessionVariables = {
    NIX_CONFIG = "extra-experimental-features = nix-command flakes";
    DOTFILES_DIR = "${config.home.homeDirectory}/code/github.com/d-issy/dotfiles";
  };

  programs.home-manager.enable = true;
  xdg.enable = true;

  imports = [
    ./atuin.nix
    ./aws.nix
    ./bat.nix
    ./carapace.nix
    ./claude.nix
    ./bottom.nix
    ./delta.nix
    ./difftastic.nix
    ./fzf.nix
    ./gcloud.nix
    ./gh.nix
    ./ghq.nix
    ./ghostty.nix
    ./git.nix
    ./lazydocker.nix
    ./lazygit.nix
    ./misc.nix
    ./navi.nix
    ./neovim
    ./node.nix
    ./nushell.nix
    ./pi.nix
    ./scripts.nix
    ./agents.nix
    ./starship.nix
    ./tmux.nix
    ./wezterm.nix
    ./worktrunk.nix
    ./zed.nix
    ./zsh.nix
  ];
}
