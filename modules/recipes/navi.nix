{ pkgs, ... }:

{
  config.dot.programs.navi = {
    enable = true;
    enableShellAliases = true;

    zshIntegration.enable = true;
    nushellIntegration.enable = true;

    settings = {
      style = {
        tag = {
          color = "cyan";
          width_percentage = 26;
          min_width = 20;
        };
        comment = {
          color = "blue";
          width_percentage = 42;
          min_width = 45;
        };
        snippet.color = "white";
      };
      finder = {
        command = "fzf";
        overrides = "--no-exact --tiebreak chunk,begin,length";
        overrides_var = "--no-exact";
      };
      shell.command = "${pkgs.zsh}/bin/zsh";
    };
  };
}
