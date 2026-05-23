{ pkgs, ... }:

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
    extensions = with pkgs; [
      gh-dash
      gh-f
      gh-notify
      gh-poi
    ];
  };
}
