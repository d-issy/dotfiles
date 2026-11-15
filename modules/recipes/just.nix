_:

{
  config.dot.programs.commandLibrary.groups.just.sections = [
    {
      when = {
        commands = [ "just" ];
        files = [
          "justfile"
          "Justfile"
          ".justfile"
        ];
        searchParents = true;
      };
      variables.recipe = {
        command = "just --summary";
        separator = "\\s+";
      };
      entries = [
        {
          description = "run just recipe";
          alias = "just";
          command = "just <recipe>";
        }
      ];
    }
  ];
}
