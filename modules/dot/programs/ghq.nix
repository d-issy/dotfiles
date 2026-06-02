{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.ghq;
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;
in
{
  options.dot.programs.ghq = {
    enable = lib.mkEnableOption "ghq";

    package = lib.mkPackageOption pkgs "ghq" { };

    root = lib.mkOption {
      type = lib.types.str;
      description = "Root directory for ghq repositories.";
      example = "~/ghq";
    };

    zshIntegration.enable = lib.mkEnableOption "zsh integration";
    nushellIntegration.enable = lib.mkEnableOption "nushell integration";
  };

  config = lib.mkIf cfg.enable {
    home.packages = [ cfg.package ];

    programs = {
      git.settings.ghq.root = cfg.root;

      zsh.initContent = lib.mkIf cfg.zshIntegration.enable ''
        function zr() {
          local repo
          repo=$(${cfg.package}/bin/ghq list -p | ${fuzzyFinderCommand})
          if [ -z "$repo" ]; then
            return
          fi
          cd "$repo"
        }
      '';

      nushell.extraConfig = lib.mkIf cfg.nushellIntegration.enable ''
        export def --env zr [] {
          let repo = (${cfg.package}/bin/ghq list -p | ${fuzzyFinderCommand} | complete | get "stdout" | str trim)
          if ($repo | is-empty) { return }
          cd $repo
        }
      '';
    };
  };
}
