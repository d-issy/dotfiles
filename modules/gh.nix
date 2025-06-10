{ config, pkgs, ... }:

{
  programs.gh = {
    enable = true;
    settings = {
      git_protocol = "ssh";
      aliases = {
        prs = "f prs";
        grep = "f greps";
      };
    };
    extensions = [
      pkgs.gh-dash
      pkgs.gh-f
      pkgs.gh-notify
      pkgs.gh-poi
    ];
  };
}
