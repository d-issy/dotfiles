{
  home.stateVersion = "24.11";

  programs.home-manager.enable = true;
  xdg.enable = true;

  imports = [
    ./eza.nix
    ./fzf.nix
    ./git.nix
    ./lazygit.nix
    ./misc.nix
    ./mise.nix
    ./navi.nix
    ./nvim.nix
    ./starship.nix
    ./tmux.nix
    ./wezterm.nix
    ./zsh.nix
  ];
}
