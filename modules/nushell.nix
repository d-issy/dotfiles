{ config, lib, pkgs, ... }:

let
  home = config.home;
in
{
  config = {
    programs.nushell = {
      enable = true;

      shellAliases = home.shellAliases;
      environmentVariables = lib.attrsets.mapAttrs (name: value: ''"${value}"'') (home.sessionVariables // { });
    };
  };
}
