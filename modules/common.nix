{
  home.stateVersion = "24.11";

  home.sessionVariables = {
    NIX_CONFIG = "extra-experimental-features = nix-command flakes";
  };

  programs.home-manager.enable = true;
  xdg.enable = true;

  imports = [
    ./aws.nix
    ./bat.nix
    ./bottom.nix
    ./delta.nix
    ./difftastic.nix
    ./eza.nix
    ./fzf.nix
    ./gcloud.nix
    ./gh.nix
    ./ghq.nix
    ./git.nix
    ./lazydocker.nix
    ./lazygit.nix
    ./misc.nix
    ./mise.nix
    ./navi.nix
    ./neovim.nix
    ./starship.nix
    ./tmux.nix
    ./wezterm.nix
    ./zsh.nix
  ];
}
