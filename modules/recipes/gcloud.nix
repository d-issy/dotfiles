{
  config,
  lib,
  ...
}:

let
  gcloud = "${config.dot.programs.gcloud.package}/bin/gcloud";
in

{
  config = {
    dot.programs.gcloud.enable = false;

    dot.programs.commandLibrary.groups.gcloud.sections = lib.mkIf config.dot.programs.gcloud.enable [
      {
        variables = {
          "configuration-name" = {
            command = "${gcloud} config configurations list";
            headers = 1;
            column = 1;
            selectOne = false;
          };
          "project-id" = {
            command = "${gcloud} projects list";
            headers = 1;
            column = 1;
            selectOne = false;
          };
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
