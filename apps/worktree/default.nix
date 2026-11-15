{ pkgs }:

import ../rust-app.nix { inherit pkgs; } {
  pname = "worktree";
  description = "Personal git worktree helper";
  nativeCheckInputs = [ pkgs.git ];
}
