{ pkgs, ... }:

{
  config = {
    dot.options.fuzzyFinder.package = pkgs.fzf;

    programs.fzf = {
      enable = true;
      defaultOptions = [
        "--reverse"
        "--border"
      ];
    };
  };
}
