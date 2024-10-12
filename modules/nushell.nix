{ config, lib, pkgs, ... }:

{
  config = {
    programs.nushell = {
      enable = true;

      shellAliases = config.home.shellAliases;
    };
  };
}
