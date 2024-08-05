{
  home.stateVersion = "24.11";

  programs.home-manager.enable = true;
  xdg.enable = true;

  imports = [
    # ./navi.nix
    ./eza.nix
    ./git.nix
    ./lazygit.nix
    ./misc.nix
    ./mise.nix
    ./starship.nix
    ./tmux.nix
    ./wezterm.nix
    ./zsh.nix
  ];
}
