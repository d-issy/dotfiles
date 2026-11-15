{
  config.dot.programs.commandLibrary = {
    enable = true;
    enableShellAliases = true;

    zshIntegration.enable = true;
    nushellIntegration.enable = true;

    fzf = {
      options = [
        "--no-exact"
        "--tiebreak"
        "chunk,begin,length"
      ];
      variableOptions = [ "--no-exact" ];
    };
  };
}
