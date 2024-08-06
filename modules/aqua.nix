{ config, pkgs, ... }:

let
  package = pkgs.buildGoModule rec {
    pname = "aqua";
    version = "2.30.0";

    src = pkgs.fetchFromGitHub {
      owner = "aquaproj";
      repo = "aqua";
      rev = "v${version}";
      hash = "sha256-Sg79G4Qfi8+bplAbyC4h8yUSvY4xTJldYRuVUN6vVIQ=";
    };

    vendorHash = "sha256-y26yOt3Jo2Jh9BVhIIK3lqJq7I3AFMrT99Ip6nNqe2I=";

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
  home.packages = [ package ];
  home.sessionVariables = {
    AQUA_GLOBAL_CONFIG = "${config.xdg.configHome}/aquaproj-aqua/aqua.yaml";
  };
  home.sessionPath = [
    "${config.xdg.dataHome}/aquaproj-aqua/bin"
  ];

  xdg.configFile."aquaproj-aqua/aqua.yaml".source = ../files/aqua/aqua.yaml;
}
