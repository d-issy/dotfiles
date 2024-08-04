{ config, pkgs, ... }:

let
  settings = builtins.fromTOML (builtins.readFile ../home/dot_config/starship.toml);
in
{
  programs.starship = {
    enable = true;
    enableZshIntegration = true;
    settings = settings;
  };
}
