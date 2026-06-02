{ lib, ... }:

let
  fzfNoSelect = "--fzf-overrides '--no-select-1'";
  dockerColumn =
    command: column:
    lib.concatStringsSep " " [
      command
      "--- --headers 1"
      "--column ${toString column}"
      fzfNoSelect
    ];
  dockerMultiColumn =
    command: column:
    lib.concatStringsSep " " [
      (dockerColumn command column)
      "--multi --expand"
    ];
in
{
  config = {
    home.shellAliases = {
      dc = "docker compose";
      dcup = "docker compose up";
      dcupd = "docker compose up -d";
      dcd = "docker compose down";
    };

    dot.programs.navi.cheats.docker.sections = [
      {
        variables = {
          image_id = dockerColumn "docker images" 3;
          image_ids = dockerMultiColumn "docker images" 3;
          container_id = dockerColumn "docker ps" 1;
          container_ids = dockerMultiColumn "docker ps" 1;
        };
        entries = [
          {
            description = "docker processlist";
            command = "docker ps";
          }
          {
            description = "docker cleanup";
            command = "docker system prune";
          }
          {
            description = "docker images";
            command = "docker images";
          }
          {
            description = "docker pull image";
            command = "docker pull <image>";
          }
          {
            description = "docker remove images";
            command = "docker rmi <image_ids>";
          }
          {
            description = "docker run";
            command = "docker run --rm -it <image_id>";
          }
          {
            description = "docker stop";
            command = "docker stop <container_ids>";
          }
          {
            description = "docker kill";
            command = "docker kill <container_ids>";
          }
          {
            description = "docker logs";
            command = "docker logs -f --tail 100 <container_id>";
          }
          {
            description = "docker stats";
            command = "docker stats";
          }
        ];
      }
    ];
  };
}
