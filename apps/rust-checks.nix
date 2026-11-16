{ pkgs }:

let
  inherit (pkgs) lib;

  crates = map baseNameOf (fromTOML (builtins.readFile ../Cargo.toml)).workspace.members;

  checkInputs = {
    tm-switcher = [ pkgs.bash ];
    worktree = [ pkgs.git ];
  };

  mkCheck =
    kind: crate: attrs:
    pkgs.rustPlatform.buildRustPackage (
      {
        pname = "rust-${kind}-${crate}";
        version = "0.1.0";
        src = import ./rust-src.nix { inherit lib; };
        cargoLock.lockFile = ../Cargo.lock;
        installPhase = ''
          touch "$out"
        '';
      }
      // attrs
    );

  clippy =
    crate:
    mkCheck "clippy" crate {
      nativeBuildInputs = [ pkgs.clippy ];
      buildPhase = ''
        runHook preBuild
        cargo clippy --offline -p ${crate} --all-targets -- -D warnings
        runHook postBuild
      '';
      doCheck = false;
    };

  test =
    crate:
    mkCheck "test" crate {
      dontCargoBuild = true;
      cargoTestFlags = [
        "-p"
        crate
      ];
      nativeCheckInputs = checkInputs.${crate} or [ ];
    };
in
lib.listToAttrs (
  lib.concatMap (crate: [
    (lib.nameValuePair "rust-clippy-${crate}" (clippy crate))
    (lib.nameValuePair "rust-test-${crate}" (test crate))
  ]) crates
)
