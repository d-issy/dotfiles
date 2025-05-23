{ config, pkgs, ... }:

{
  programs.zsh = {
    enable = true;

    history = {
      size = 10000;
      save = 10000;
      append = true;
      ignoreDups = true;
      ignoreAllDups = true;
      ignoreSpace = true;
      expireDuplicatesFirst = true;
      share = true;
      extended = true;
    };

    # plugins
    enableCompletion = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;
    plugins = [
      {
        name = "vi-mode";
        src = pkgs.zsh-vi-mode;
        file = "share/zsh-vi-mode/zsh-vi-mode.plugin.zsh";
      }
    ];

    # alias
    shellGlobalAliases = {
      G = "| grep --color=auto";
    };

    initContent = builtins.readFile ../files/zsh/rc;

    profileExtra = ''
      if [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      fi
    '';
  };
}
