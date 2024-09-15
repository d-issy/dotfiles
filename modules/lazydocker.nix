{ config, pkgs, ... }:

{
  config = {
    home.packages = [
      pkgs.lazydocker
    ];

    programs.zsh.shellAliases = {
      ld = "lazydocker";
    };
  };
}
