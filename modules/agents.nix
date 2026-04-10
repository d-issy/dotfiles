{ lib, ... }:
let
  skillsSrc = ../files/agents/skills;
in
{
  config = {
    # Copy instead of symlink to work around Glob symlink limitation
    home.activation.agentSkills = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
      for dir in "$HOME/.claude/skills" "$HOME/.cursor/skills" "$HOME/.agents/skills"; do
        mkdir -p "$dir"
        chmod -R u+w "$dir/runbook" 2>/dev/null || true
        rm -rf "$dir/runbook"
        mkdir -p "$dir/runbook"
        cp -rL ${skillsSrc}/runbook/* "$dir/runbook/"
      done
    '';
  };
}
