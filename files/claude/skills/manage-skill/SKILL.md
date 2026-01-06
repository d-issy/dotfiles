---
name: manage-skill
description: Manage Claude Code skills. Use this when user wants to create, edit, update, delete a skill.
allowed-tools: Read, Write, Edit, Glob, Bash(mkdir:*)
---

# Manage Skill

## Purpose

Execute the `Workflow` and `Report` sections to manage Claude Code skills.

## Variables

- IS_DOTFILES: `true` if current repo is dotfiles, otherwise `false`
- SCOPE:
  - if IS_DOTFILES, then ask user (user-level/project-local)
  - if not IS_DOTFILES, then `project-local`
- SKILLS_DIR:
  - if user-level then `files/claude/skills`
  - if project-local then `.claude/skills`
- SETTINGS_FILE:
  - if user-level then `files/claude/settings.json`
  - if project-local then `.claude/settings.local.json`

## Workflow

1. Determine the operation (create, edit, or delete) from user's request
2. Execute the operation:
   - If **create**, then:
     - If requirements unclear, then ask using AskUserQuestion: skill name, purpose, tool restrictions
     - If IS_DOTFILES, then ask scope (user-level/project-local)
     - Create `SKILLS_DIR/[skill-name]/SKILL.md`
     - Follow the format in [format.md](format.md), see [basic-structure.md](basic-structure.md) for template
   - If **edit**, then:
     - Locate `SKILLS_DIR/[skill-name]`
     - Read and modify `SKILL.md` or supporting files as requested
   - If **delete**, then:
     - Confirm with user before deletion
     - Remove `SKILLS_DIR/[skill-name]`
3. Update `SETTINGS_FILE` permissions as needed

## Report

Inform the user:

- The operation performed and skill location
- For user-level: remind to run Nix to deploy
- For project-local: immediately available in the current project
