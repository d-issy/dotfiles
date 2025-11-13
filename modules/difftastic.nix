{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.difftastic ];
    home.shellAliases = { gd = "git difft"; };

    programs.git.settings = {
      alias = {
        difft = "!f() { GIT_EXTERNAL_DIFF=difft git diff \"$@\"; }; f";
      };
    };
  };
}
