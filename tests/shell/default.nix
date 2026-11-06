{ pkgs }:

let
  gh = pkgs.writeShellScriptBin "gh" ''
    printf '%s\n' "$TEST_PR_BRANCH"
  '';
  worktreeScript = pkgs.writeText "worktree-under-test.sh" (
    import ../../modules/dot/programs/scripts/worktree/script.nix {
      cfg = {
        model = null;
        thinking = null;
      };
      fuzzyFinderCommand = "unused-fuzzy-finder";
      inherit (pkgs) lib;
      pkgs = pkgs // {
        inherit gh;
      };
    }
  );
in
pkgs.runCommand "worktree-regressions"
  {
    nativeBuildInputs = with pkgs; [
      bash
      coreutils
      git
      gnused
    ];
    WORKTREE_SCRIPT = worktreeScript;
  }
  ''
    bash ${./worktree.sh}
    touch "$out"
  ''
