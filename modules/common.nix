{
  home.stateVersion = "24.11";

  home.sessionVariables = {
    NIX_CONFIG = "extra-experimental-features = nix-command flakes";
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
    ./eza.nix
    ./fzf.nix
    ./gcloud.nix
    ./gh.nix
    ./ghq.nix
    ./ghostty.nix
    ./git.nix
    ./lazydocker.nix
    ./lazygit.nix
    ./misc.nix
    ./mise.nix
    ./navi.nix
    ./neovim.nix
    ./nushell.nix
    ./opencode.nix
    ./starship.nix
    ./tmux.nix
    ./wezterm.nix
    ./zed.nix
    ./zsh.nix
  ];
}
