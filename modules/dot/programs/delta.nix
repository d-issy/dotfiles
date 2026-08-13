{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.delta;
in
{
  options.dot.programs.delta = {
    enable = lib.mkEnableOption "delta";

    package = lib.mkPackageOption pkgs "delta" { };

    integrations.lazygit.enable = lib.mkEnableOption "Delta integration for Lazygit";
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ];

    programs.git.settings = {
      interactive.diffFilter = "delta --color-only";
      diff.colorMoved = "default";
      delta = {
        diff-so-fancy = true;
        line-numbers = true;
      };
      alias.delta = "!f() { git diff \"$@\" | delta --side-by-side; }; f";
    };

    programs.lazygit.settings =
      lib.mkIf (cfg.integrations.lazygit.enable && config.programs.lazygit.enable)
        {
          git.diffRenderers = [
            {
              command = "delta --paging=never";
            }
          ];
        };
  };
}
