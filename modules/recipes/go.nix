{ pkgs, ... }:

{
  config.dot.programs.commandLibrary.groups.go.sections = [
    {
      when.commands = [ "go" ];
      variables."main-file" = "${pkgs.ripgrep}/bin/rg -l '^package main$' -g '*.go'";
      entries = [
        {
          description = "go run";
          command = "go run <main-file>";
        }
      ];
    }
  ];
}
