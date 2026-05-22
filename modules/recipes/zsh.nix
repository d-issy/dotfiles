{ config, ... }:

{
  programs.zsh = {
    enable = true;
    dotDir = config.home.homeDirectory;

    profileExtra = ''
      if [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      fi
    '';
  };
}
