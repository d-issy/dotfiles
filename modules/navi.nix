{ config, pkgs, lib, ... }:

with lib;

let
  yamlFormat = pkgs.formats.yaml { };
  settings = {
    style = {
      tag = {
        color = "cyan";
        with_percentage = 26;
        min_width = 20;
      };
      comments = {
        color = "blue";
        with_percentage = 42;
        min_width = 45;
      };
      snippet.color = "white";
    };
    finder = {
      command = "fzf";
      overrides = "--no-exact";
      overrides_var = "--no-exact --no-select-1";
    };
    cheats.paths = [
      "~/cheats/"
    ];
    shell.command = "zsh";
  };
in
{
  config = {
    home.packages = [ pkgs.navi ];

    programs.zsh.initExtra = ''
      eval "$(${pkgs.navi}/bin/navi widget zsh)"
    '';

    xdg.configFile."navi/config.yaml" = mkIf (settings != { }) {
      source = yamlFormat.generate "navi-config" settings;
    };

    home.file."cheats" = {
      source = ../files/cheats;
      recursive = true;
    };
  };
}
