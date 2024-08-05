{
  home.stateVersion = "24.11";

  programs.home-manager.enable = true;
  xdg.enable = true;

  imports = [
    ./git.nix
    ./lazygit.nix
    ./misc.nix
    ./mise.nix
    # ./navi.nix
    ./starship.nix
    ./tmux.nix
    ./zsh.nix
  ];
}
