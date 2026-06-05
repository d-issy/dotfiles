{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.dot.programs.scripts.worktree;
  fuzzyFinderCommand = config.dot.options.fuzzyFinder.command;

  worktreeScript = import ./script.nix {
    inherit
      cfg
      fuzzyFinderCommand
      lib
      pkgs
      ;
  };

  worktree = pkgs.writeShellApplication {
    name = "worktree";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.fd
      pkgs.gawk
      pkgs.gnused
    ];
    text = worktreeScript;
  };

  shellIntegration = import ./shell-integration.nix {
    inherit pkgs;
    worktreeBin = "${worktree}/bin/worktree";
  };
in
{
  options.dot.programs.scripts.worktree = {
    enable = lib.mkEnableOption "personal worktree command";

    model = lib.mkOption {
      type = with lib.types; nullOr str;
      default = null;
      description = "Pi model passed to worktree name generation. When null, no --model option is passed.";
    };

    thinking = lib.mkOption {
      type =
        with lib.types;
        nullOr (enum [
          "off"
          "minimal"
          "low"
          "medium"
          "high"
          "xhigh"
        ]);
      default = null;
      description = "Pi thinking level passed to worktree name generation. When null, no --thinking option is passed.";
    };

    shellIntegration.zsh.enable = lib.mkOption {
      type = lib.types.bool;
      default = config.dot.programs.scripts.shellIntegration.zsh.enable;
      defaultText = lib.literalExpression "config.dot.programs.scripts.shellIntegration.zsh.enable";
      description = "Whether to install the worktree cd wrapper for zsh.";
    };

    shellIntegration.nushell.enable = lib.mkOption {
      type = lib.types.bool;
      default = config.dot.programs.scripts.shellIntegration.nushell.enable;
      defaultText = lib.literalExpression "config.dot.programs.scripts.shellIntegration.nushell.enable";
      description = "Whether to install the worktree cd wrapper for nushell.";
    };
  };

  config = lib.mkIf (config.dot.programs.scripts.enable && cfg.enable) {
    home.packages = [ worktree ];

    programs.zsh.initContent = lib.mkIf cfg.shellIntegration.zsh.enable shellIntegration.zsh;
    programs.nushell.extraConfig = lib.mkIf cfg.shellIntegration.nushell.enable shellIntegration.nushell;
  };
}
