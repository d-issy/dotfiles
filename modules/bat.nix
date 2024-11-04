{ config, pkgs, ... }:

{
  config = {
    home.shellAliases = { cat = "bat"; };

    programs.bat = {
      enable = true;
      config = {
        theme = "1337";
      };
    };
  };
}
