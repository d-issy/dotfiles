{ config, pkgs, ... }:
{
  config = {
    home.shellAliases = {
      ".." = "cd..";
      dc = "docker compose";
    };

    home.packages = [
      pkgs.curl
      pkgs.duckdb
      pkgs.fastly
      pkgs.glow
      pkgs.gnumake
      pkgs.grpcurl
      pkgs.jq
      pkgs.jqp
      pkgs.ripgrep
      pkgs.typos
      pkgs.visidata
      pkgs.wget
    ];

    programs = {
      direnv.enable = true;
      zoxide.enable = true;
    };
  };
}
