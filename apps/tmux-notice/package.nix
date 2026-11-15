# Unwrapped tmux-notice crate. The Nix modules wrap its single binary once per
# command name (it dispatches on argv[0]).
{ pkgs }:

import ../rust-app.nix { inherit pkgs; } {
  pname = "tmux-notice";
  description = "tmux pane notice helper and status commands";
}
