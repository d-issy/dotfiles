{ pkgs }:

let
  gh = pkgs.writeShellScriptBin "gh" ''
    printf '%s\n' "$TEST_PR_BRANCH"
  '';
  worktree = import ../../modules/dot/programs/scripts/worktree/package.nix {
    cfg = {
      model = null;
      thinking = null;
    };
    fuzzyFinderCommand = "unused-fuzzy-finder";
    inherit (pkgs) lib;
    inherit pkgs gh;
  };
in
pkgs.runCommand "worktree-regressions"
  {
    nativeBuildInputs = with pkgs; [
      bash
      coreutils
      git
      gnused
    ];
    WORKTREE_BIN = "${worktree}/bin/worktree";
  }
  ''
    bash ${./worktree.sh}
    touch "$out"
  ''
