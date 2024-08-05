{ config, pkgs, ... }:
{
  config = {
    programs.fzf = {
      enable = true;
      defaultOptions = [
        "--reverse"
        "--border"
      ];
    };
  };
}
