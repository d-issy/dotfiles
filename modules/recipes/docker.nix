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
          image_id = "docker images --- --headers 1 --column 3 --fzf-overrides '--no-select-1'";
          image_ids = "docker images --- --headers 1 --column 3 --multi --expand --fzf-overrides '--no-select-1'";
          container_id = "docker ps --- --headers 1 --column 1 --fzf-overrides '--no-select-1'";
          container_ids = "docker ps --- --headers 1 --column 1 --multi --expand --fzf-overrides '--no-select-1'";
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
