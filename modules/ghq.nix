{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.ghq ];


    programs.git.extraConfig.ghq.root = "~/code";

    # TODO: move to navi
    programs.zsh.initExtra = ''
      function zr() {
        cd $(${pkgs.ghq}/bin/ghq list -p  | fzf)
      }
    '';

  };
}
