{ config, pkgs, ... }:

let
  settings = {
    row = [
      {
        ratio = 2;
        child = [
          { type = "cpu"; }
          { type = "memory"; }
        ];
      }
      {
        ratio = 2;
        child = [
          { type = "network"; }
          { type = "disk"; }
        ];
      }
      {
        ratio = 3;
        child = [{ type = "process"; default = true; }];
      }
    ];
  };
in
{
  config = {
    home.shellAliases = { htop = "btm -b"; };
    programs.bottom = {
      enable = true;
      settings = settings;
    };
  };
}
