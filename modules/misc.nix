{ config, pkgs, ... }:
{
  config = {
    home.packages = [
      pkgs.curl
      pkgs.visidata
      pkgs.devbox
      pkgs.duckdb
      pkgs.glow
      pkgs.gnumake
      pkgs.grpcurl
      pkgs.htop
      pkgs.jq
      pkgs.jqp
      pkgs.ripgrep
      pkgs.wget
    ];
    programs = {
      direnv.enable = true;
      zoxide.enable = true;
    };
  };
}
