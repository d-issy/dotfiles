{ pkgs, ... }:

{
  config = {
    dot.programs.ghq = {
      enable = true;
      root = "~/code";

      zshIntegration.enable = true;
      nushellIntegration.enable = true;
    };

    dot.programs.navi.cheats.ghq.sections = [
      {
        variables.git_repo = "${pkgs.coreutils}/bin/echo git@github.com:<username>/<repo>.git";
        entries = [
          {
            description = "clone github repository";
            command = "ghq get <git_repo>";
          }
        ];
      }
    ];
  };
}
