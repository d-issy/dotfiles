{ lib, ... }:

{
  imports = [
    ./git-autocommit.nix
    ./worktree
  ];

  options.dot.programs.scripts.enable = lib.mkEnableOption "personal shell scripts";
}
