{ config, pkgs, ... }:
{
  config = {
    home.shellAliases = {
      ".." = "cd..";
      dev = "devbox";
      dc = "docker compose";
    };

    home.packages = [
      pkgs.curl
      pkgs.devbox
      pkgs.glow
      pkgs.gnumake
      pkgs.grpcurl
      pkgs.jq
      pkgs.jqp
      pkgs.ripgrep
      pkgs.visidata
      pkgs.wget
    ];
    programs = {
      direnv.enable = true;
      zoxide.enable = true;
    };
  };
}
