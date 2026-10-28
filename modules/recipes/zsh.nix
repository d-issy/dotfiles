{ config, ... }:

{
  programs.zsh = {
    enable = true;
    dotDir = config.home.homeDirectory;

    envExtra = ''
      # macOS updates can remove Nix initialization from /etc/zshrc.
      if [ -r /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then
        . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
      fi
    '';

    profileExtra = ''
      if [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      fi
    '';
  };
}
