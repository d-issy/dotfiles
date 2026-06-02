{
  pkgs,
  lib,
  files,
}:

{
  readFile = import ./readFile.nix { inherit files; };
  mergeJson = import ./mergeJson.nix { inherit pkgs lib; };
  mkEnablablePackageOption = import ./mkEnablablePackageOption.nix { inherit lib pkgs; };
}
