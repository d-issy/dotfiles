{ config, pkgs, ... }:

{
  config = {
    home.sessionVariables = {
      CARAPACE_BRIDGES = "fish,zsh,bash,inshellisense";
    };

    programs.carapace = {
      enable = true;
    };
  };
}
