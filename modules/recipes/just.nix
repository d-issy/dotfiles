{ pkgs, ... }:

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
      };
      variables.recipe = "just --summary | ${pkgs.coreutils}/bin/tr ' ' '\\n'";
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
