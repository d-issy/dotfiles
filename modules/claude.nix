{ config, pkgs, ... }: {
  config = {
    home.file.".claude/CLAUDE.md" = {
      source = ../files/claude/CLAUDE.md;
    };

    home.file.".claude/settings.json" = {
      source = ../files/claude/settings.json;
    };
  };
}