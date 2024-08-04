{ config, pkgs, ... }:

{
  programs.zsh = {
    enable = true;

    history.ignoreDups = true;

    # plugins
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;

    initExtra = builtins.readFile ../home/dot_zshrc;
  };
}
