{ lib }:

lib.fileset.toSource {
  root = ../.;
  fileset = lib.fileset.unions [
    ../Cargo.toml
    ../Cargo.lock
    (lib.fileset.fileFilter (file: !(file.hasExt "ts") && !(file.hasExt "nix")) ./.)
  ];
}
