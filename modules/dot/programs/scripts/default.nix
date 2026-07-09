{
  config,
  lib,
  ...
}:

{
  imports = [
    ./git-autocommit.nix
    ./hr.nix
    ./tm.nix
    ./tmux-notice
    ./worktree
  ];

  options.dot.programs.scripts = {
    enable = lib.mkEnableOption "personal shell scripts";

    shellIntegration.nushell.enable = lib.mkOption {
      type = lib.types.bool;
      default = config.programs.nushell.enable;
      defaultText = lib.literalExpression "config.programs.nushell.enable";
      description = "Whether scripts install Nushell shell integrations by default.";
    };
  };
}
