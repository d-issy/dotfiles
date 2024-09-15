{
  home.stateVersion = "24.11";

  home.sessionVariables = {
    NIX_CONFIG = "extra-experimental-features = nix-command flakes";
  };

  programs.home-manager.enable = true;
  xdg.enable = true;

  imports = [
    ./aqua.nix
    ./eza.nix
    ./fzf.nix
    ./gh.nix
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
