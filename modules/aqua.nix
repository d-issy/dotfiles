{ config, pkgs, ... }:

let
  aqua = pkgs.buildGoModule rec {
    pname = "aqua";
    version = "2.31.0";

    src = pkgs.fetchFromGitHub {
      owner = "aquaproj";
      repo = "aqua";
      rev = "v${version}";
      hash = "sha256-ZQLqTsMWntnF1wTs5iQdC7T44skSsc0oSC8SEPhZ7PY=";
    };

    vendorHash = "sha256-XnZPDuD+geTKStBon7tJsQPb4sU+vTmH71bWiqRgCyU=";

    ldflags = [
      "-s"
      "-w"
      "-X main.version=${version}"
      "-X main.commit=${src.rev}"
      "-X main.date=unknown"
    ];

    subPackages = [ "cmd/aqua" ];
  };
in
{
  home.packages = [ aqua ];
  home.sessionVariables = {
    AQUA_GLOBAL_CONFIG = "${config.xdg.configHome}/aquaproj-aqua/aqua.yaml";
  };
  home.sessionPath = [
    "${config.xdg.dataHome}/aquaproj-aqua/bin"
  ];

  xdg.configFile."aquaproj-aqua/aqua.yaml".source = ../files/aqua/aqua.yaml;
}
