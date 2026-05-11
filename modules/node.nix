{ config, pkgs, ... }:

{
  programs.npm = {
    enable = true;
    package = pkgs.nodejs_24;
    settings = {
      prefix = "${config.home.homeDirectory}/.npm-global";
      fund = false;
      audit = false;
    };
  };

  home = {
    packages = [
      pkgs.pnpm
    ];

    sessionVariables = {
      PNPM_HOME = "${config.home.homeDirectory}/.local/share/pnpm";
    };

    sessionPath = [
      "${config.home.homeDirectory}/.npm-global/bin"
      "${config.home.homeDirectory}/.local/share/pnpm"
    ];
  };
}
