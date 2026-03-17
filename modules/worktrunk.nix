{ config, pkgs, ... }:

let
  wtNuInit = pkgs.runCommand "wt-nu-init" { } ''
    ${pkgs.worktrunk}/bin/wt config shell init nu > $out
  '';
in
{
  config = {
    home.packages = [ pkgs.worktrunk ];

    programs.zsh.initContent = ''
      eval "$(${pkgs.worktrunk}/bin/wt config shell init zsh)"
    '';

    xdg.dataFile."nushell/vendor/autoload/wt.nu".source = wtNuInit;
  };
}
