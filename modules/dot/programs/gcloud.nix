{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.gcloud;
in
{
  options.dot.programs.gcloud = {
    enable = lib.mkEnableOption "Google Cloud SDK";

    package = lib.mkPackageOption pkgs "google-cloud-sdk" { };
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ];
  };
}
