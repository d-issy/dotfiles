_:

{
  home.stateVersion = "24.11";

  home.sessionVariables = {
    NIX_CONFIG = "extra-experimental-features = nix-command flakes";
  };

  programs.home-manager.enable = true;
  xdg.enable = true;

  imports = [
    ./agents.nix
    ./atuin.nix
    ./aws.nix
    ./bat.nix
    ./bottom.nix
    ./carapace.nix
    ./claude.nix
    ./delta.nix
    ./difftastic.nix
    ./fzf.nix
    ./gcloud.nix
    ./gh.nix
    ./ghq.nix
    ./ghostty.nix
    ./git.nix
    ./hammerspoon.nix
    ./lazydocker.nix
    ./lazygit.nix
    ./misc.nix
    ./navi.nix
    ./neovim
    ./node.nix
    ./nushell.nix
    ./pi.nix
    ./scripts.nix
    ./starship.nix
    ./tmux.nix
    ./wezterm.nix
    ./worktrunk.nix
    ./zed.nix
    ./zsh.nix
  ];
}
