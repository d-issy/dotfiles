{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.ghq ];

    programs.git.extraConfig.ghq.root = "~/code";

    programs.zsh.initExtra = ''
      function zr() {
        cd $(${pkgs.ghq}/bin/ghq list -p  | fzf)
      }
    '';

    programs.nushell.extraConfig = ''
      export def zr [] {
        cd (${pkgs.ghq}/bin/ghq list -p  | fzf)
      }
    '';
  };
}
