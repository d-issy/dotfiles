{ config, pkgs, ... }:

let
  settings = builtins.fromTOML (builtins.readFile ../files/starship/config.toml);
in
{
  programs.starship = {
    enable = true;
    settings = settings;
  };
}
