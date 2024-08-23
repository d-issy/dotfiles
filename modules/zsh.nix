{ config, pkgs, ... }:

{
  programs.zsh = {
    enable = true;

    history.ignoreDups = true;

    # plugins
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;

    # alias
    shellAliases = {
      ".." = "cd..";
      dc = "docker compose";
      ld = "lazydocker";
      lg = "lazygit";
    };
    shellGlobalAliases = {
      G = "| grep --color=auto";
    };

    initExtra = builtins.readFile ../files/zsh/rc;
    profileExtra = builtins.readFile ../files/zsh/profile;
  };
}
