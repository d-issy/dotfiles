# Builds one binary crate from the Cargo workspace rooted at the repository.
{ pkgs }:

{
  pname,
  description,
  mainProgram ? pname,
  nativeCheckInputs ? [ ],
}:

let
  inherit (pkgs) lib;
in
pkgs.rustPlatform.buildRustPackage {
  inherit pname nativeCheckInputs;
  version = "0.1.0";

  src = import ./rust-src.nix { inherit lib; };

  cargoLock.lockFile = ../Cargo.lock;

  cargoBuildFlags = [
    "-p"
    pname
  ];
  cargoTestFlags = [
    "-p"
    pname
  ];

  meta = {
    inherit description mainProgram;
  };
}
