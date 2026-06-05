{
  config,
  lib,
  ...
}:

{
  imports = [
    ./git-autocommit.nix
    ./worktree
  ];

  options.dot.programs.scripts = {
    enable = lib.mkEnableOption "personal shell scripts";

    shellIntegration.zsh.enable = lib.mkOption {
      type = lib.types.bool;
      default = config.programs.zsh.enable;
      defaultText = lib.literalExpression "config.programs.zsh.enable";
      description = "Whether scripts install zsh shell integrations by default.";
    };

    shellIntegration.nushell.enable = lib.mkOption {
      type = lib.types.bool;
      default = config.programs.nushell.enable;
      defaultText = lib.literalExpression "config.programs.nushell.enable";
      description = "Whether scripts install Nushell shell integrations by default.";
    };
  };
}
