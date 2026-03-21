{ lib, ... }:
let
  skillsSrc = ../files/skills;
in
{
  config = {
    # Claude Code + OpenCode
    home.file.".claude/skills" = {
      source = skillsSrc;
      recursive = true;
    };

    # Cursor
    home.file.".cursor/skills" = {
      source = skillsSrc;
      recursive = true;
    };

    # Codex (copy instead of symlink to work around Codex symlink bug)
    home.activation.codexSkills = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
      mkdir -p "$HOME/.agents/skills"
      chmod -R u+w "$HOME/.agents/skills/meta" 2>/dev/null || true
      rm -rf "$HOME/.agents/skills/meta"
      cp -rL "${skillsSrc}/meta" "$HOME/.agents/skills/meta"
    '';
  };
}
