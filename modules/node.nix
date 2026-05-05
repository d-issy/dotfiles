{ config, pkgs, ... }:

{
  programs.npm = {
    enable = true;
    package = pkgs.nodejs_24;
    settings = {
      prefix = "${config.home.homeDirectory}/.npm-global";
      fund = false;
      audit = false;
    };
  };

  home.sessionPath = [ "${config.home.homeDirectory}/.npm-global/bin" ];
}
