{ pkgs, ... }:

{
  config.dot.programs.navi.cheats.go.sections = [
    {
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
