{ lib, ... }:

{
  imports = [
    ./git-autocommit.nix
  ];

  options.dot.programs.scripts.enable = lib.mkEnableOption "personal shell scripts";
}
