{ pkgs, ... }:

{
  home.packages = [ pkgs.openspec ];

  dot.programs.commandLibrary.groups.openspec.sections = [
    {
      tags = [ "openspec" ];
      variables.change = {
        command = "openspec list --json";
        json = "changes[].name";
      };
      entries = [
        {
          description = "OpenSpec status";
          alias = "opsxs";
          command = "openspec status --change <change>";
        }
        {
          description = "OpenSpec init";
          alias = "opsxi";
          command = "openspec init --tools none";
        }
        {
          description = "OpenSpec list";
          alias = "opsxl";
          command = "openspec list";
        }
        {
          description = "OpenSpec validate";
          alias = "opsxv";
          command = "openspec validate <change>";
        }
        {
          description = "OpenSpec validate all";
          alias = "opsxva";
          command = "openspec validate";
        }
      ];
    }
  ];
}
