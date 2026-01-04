---
name: manage-dotfiles
description: Manage Nix modules and Home Manager configuration. Use this when user wants to check or modify config under HOME directory (e.g., neovim, tmux, terminal, zsh, git).
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(mkdir:*)
---

# Manage Dotfiles

## Purpose

Execute the `Workflow` and `Report` sections to manage Nix modules and Home Manager configuration.

## Variables

- MODULES_DIR: `modules/`
- COMMON_NIX: `modules/common.nix`
- FILES_DIR: `files/`
- HOME_NIX:
  - if linux then `home.linux.nix`
  - if macos then `home.macos.nix`

## Instructions

This dotfiles uses Home Manager with Nix Flakes.

| What         | Where                  | Notes                          |
| ------------ | ---------------------- | ------------------------------ |
| Nix module   | MODULES_DIR/[name].nix | Add import to COMMON_NIX       |
| Config files | FILES_DIR/[app-name]/  | Link via `home.file` in module |

See [module-template.md](module-template.md) for Nix module patterns.

## Workflow

1. Read existing files to understand current structure
2. Create/edit files based on user's request
3. If new module, add import to COMMON_NIX

## Report

- Files created/modified
- If new files created: remind to run `git add` (Nix Flakes only recognizes git-tracked files)
- Remind to run: `nix run . switch`
