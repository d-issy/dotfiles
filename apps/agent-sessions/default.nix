{ pkgs }:

import ../rust-app.nix { inherit pkgs; } {
  pname = "agent-sessions";
  description = "Watch Claude Code and Codex sessions live";
  mainProgram = "agent-session";
}
