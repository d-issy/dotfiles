{ config, pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.ghq ];

    programs.git.settings.ghq.root = "~/code";

    programs.zsh.initContent = ''
      function zr() {
        cd $(${pkgs.ghq}/bin/ghq list -p  | fzf)
      }
    '';

    programs.nushell.extraConfig = ''
      export def --env zr [] {
        cd (${pkgs.ghq}/bin/ghq list -p  | fzf)
      }
    '';
  };
}
