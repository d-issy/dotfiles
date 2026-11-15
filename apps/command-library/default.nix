{ pkgs }:

import ../rust-app.nix { inherit pkgs; } {
  pname = "command-library";
  description = "Pick a command from the command library with fzf";
}
