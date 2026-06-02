{ pkgs, ... }:

{
  config = {
    home.packages = [ pkgs.google-cloud-sdk ];

    dot.programs.navi.cheats.gcloud.sections = [
      {
        variables = {
          "configuration-name" =
            "${pkgs.google-cloud-sdk}/bin/gcloud config configurations list --- --headers 1 --column 1 --fzf-overrides '--no-select-1'";
          "project-id" =
            "${pkgs.google-cloud-sdk}/bin/gcloud projects list --- --headers 1 --column 1 --fzf-overrides '--no-select-1'";
        };
        entries = [
          {
            description = "gcloud Login Auth";
            command = "gcloud auth login";
          }
          {
            description = "gcloud Login Application Default Credentials";
            command = "gcloud auth application-default login";
          }
          {
            description = "gcloud List Configurations";
            command = "gcloud config configurations list";
          }
          {
            description = "gcloud Activate";
            command = "gcloud config configurations activate <configuration-name>";
          }
          {
            description = "gcloud Set Project";
            command = "gcloud config set project <project-id>";
          }
          {
            description = "gcloud List Config";
            command = "gcloud config list";
          }
        ];
      }
    ];
  };
}
