{
  config.dot.programs.navi.cheats.go.sections = [
    {
      entries = [
        {
          description = "go run";
          command = "go run <main-file>";
        }
      ];
      variables."main-file" = "rg -l '^package main$' -g '*.go'";
    }
  ];
}
