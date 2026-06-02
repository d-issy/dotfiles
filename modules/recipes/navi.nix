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
          with_percentage = 26;
          min_width = 20;
        };
        comments = {
          color = "blue";
          with_percentage = 42;
          min_width = 45;
        };
        snippet.color = "white";
      };
      finder = {
        command = "${pkgs.fzf}/bin/fzf";
        overrides = "--no-exact --tiebreak chunk,begin,length";
        overrides_var = "--no-exact";
      };
      shell.command = "${pkgs.zsh}/bin/zsh";
    };
  };
}
