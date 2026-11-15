# Source tree of the Cargo workspace: the manifests plus everything under apps/
# except the Nix expressions.
{ lib }:

lib.fileset.toSource {
  root = ../.;
  fileset = lib.fileset.unions [
    ../Cargo.toml
    ../Cargo.lock
    (lib.fileset.fileFilter (file: !(file.hasExt "ts") && !(file.hasExt "nix")) ./.)
  ];
}
