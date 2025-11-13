{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.delta ];
    programs.git.settings = {
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
      git.pagers = [
        {
          pager = "delta --paging=never";
        }
      ];
    };
  };
}
