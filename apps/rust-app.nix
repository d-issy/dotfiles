{ pkgs }:

let
  inherit (pkgs) lib;

  # Build every workspace app in one derivation so shared dependencies compile
  # and link once instead of once per app.
  workspace = pkgs.rustPlatform.buildRustPackage {
    pname = "dot-apps";
    version = "0.1.0";

    src = import ./rust-src.nix { inherit lib; };

    cargoLock.lockFile = ../Cargo.lock;

    cargoBuildFlags = [ "--workspace" ];

    # Tests run in the rust-test-* flake checks; skip them when applying.
    doCheck = false;
  };
in
{
  pname,
  description,
  mainProgram ? pname,
}:

pkgs.runCommand pname
  {
    meta = {
      inherit description mainProgram;
    };
  }
  ''
    mkdir -p "$out/bin"
    ln -s ${workspace}/bin/${mainProgram} "$out/bin/${mainProgram}"
  ''
