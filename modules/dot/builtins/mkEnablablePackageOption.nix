{ lib, pkgs }:

name: packageName: {
  enable = lib.mkEnableOption name;
  package = lib.mkPackageOption pkgs packageName { };
}
