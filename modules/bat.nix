{ config, pkgs, ... }:
{
  config = {
    programs.bat.enable = true;
    programs.zsh.shellAliases = {
      cat = "bat";
    };
  };

}
