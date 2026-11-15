_:

{
  config = {
    dot.programs.ghq = {
      enable = true;
      root = "~/code";

      zshIntegration.enable = true;
      nushellIntegration.enable = true;
    };

    dot.programs.commandLibrary.groups.ghq.sections = [
      {
        entries = [
          {
            description = "clone github repository";
            command = "ghq get git@github.com:<username>/<repo>.git";
          }
        ];
      }
    ];
  };
}
