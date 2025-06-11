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
    ./codex.nix
    ./bottom.nix
    ./delta.nix
    ./difftastic.nix
    ./eza.nix
    ./fzf.nix
    ./gcloud.nix
    ./gh.nix
    ./ghq.nix
    ./git.nix
    ./gitworktree.nix
    ./lazydocker.nix
    ./lazygit.nix
    ./misc.nix
    ./mise.nix
    ./navi.nix
    ./neovim.nix
    ./nushell.nix
    ./starship.nix
    ./tmux.nix
    ./wezterm.nix
    ./zsh.nix
  ];
}
