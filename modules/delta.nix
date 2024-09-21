{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.delta ];
    programs.git.extraConfig = {
      interactive.diffFilter = "delta --color-only";
      diff = {
        colorMoved = "default";
      };
      delta = {
        diff-so-fancy = true;
        line-numbers = true;
      };
      alias = {
        delta = "!f() { git diff \"$@\" | delta --side-by-side; }; f";
      };
    };

    programs.lazygit.settings = {
      git.paging = {
        colorAlways = true;
        pager = "delta --paging=never";
      };
    };
  };
}
