{ config, pkgs, ... }:
{
  config = {
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
