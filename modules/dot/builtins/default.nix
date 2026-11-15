{
  pkgs,
  lib,
  files,
}:

{
  readFile = import ./readFile.nix { inherit files; };
  mergeJson = import ./mergeJson.nix { inherit pkgs lib; };
  mkEnableablePackageOption = import ./mkEnableablePackageOption.nix { inherit lib pkgs; };
}
