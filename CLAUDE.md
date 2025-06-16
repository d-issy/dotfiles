# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Global Configuration Management

When asked about "global" configuration for any tool, follow this systematic approach:

### 1. Search for Nix Module
First, search for the corresponding Nix module in `modules/` directory:
- Look for `modules/[tool-name].nix` (e.g., `modules/git.nix`, `modules/wezterm.nix`)
- Check `modules/common.nix` imports to understand which tools are configured

### 2. Locate Configuration Files
Find associated configuration files in `files/` directory:
- Look for `files/[tool-name]/` directory (e.g., `files/nvim/`, `files/claude/`)
- Check for direct configuration files referenced in the module

### 3. Understand the Structure
Analyze how the module links to configuration files:
- **Direct configuration**: Settings defined within the Nix module
- **File symlinking**: External files linked via `xdg.configFile` or `home.file`
- **Mixed approach**: Combination of both methods

### 4. Make Appropriate Changes
- **Module changes**: Modify settings directly in the `.nix` file
- **Configuration file changes**: Edit files in `files/` directory
- **New configurations**: Create both module and configuration files as needed

### Example: Claude Code Configuration
- **Module**: `modules/claude.nix` - Manages Claude Code configuration files
- **Global Instructions**: `files/claude/CLAUDE.md` - Global behavior and workflow instructions
- **Settings**: `files/claude/settings.json` - Security permissions and tool restrictions
- **Cheat Sheet**: `files/cheats/claude.cheat` - Quick reference commands

These files are automatically deployed to `~/.claude/` directory through Home Manager.

## Commands

See @README.md for setup and apply commands.

## Architecture

This is a **Nix Flakes-based Home Manager configuration** that manages user environment and dotfiles across Linux and macOS platforms using a modular architecture.

### Key Structure
- `flake.nix` - Main flake configuration defining homeConfigurations for linux/macos/macos_intel
- `home.linux.nix` / `home.macos.nix` - Platform-specific entry points
- `modules/common.nix` - Central hub importing all shared modules (37 total)
- `modules/` - Individual tool/program configurations
- `files/` - Application-specific configuration files

### Module Patterns

**Simple Package Installation** (misc.nix):
```nix
{ config, pkgs, ... }: {
  config = {
    home.packages = [ pkgs.curl pkgs.jq ];
    home.shellAliases = { dc = "docker compose"; };
  };
}
```

**Program Configuration** (fzf.nix, gh.nix):
```nix
programs.fzf = {
  enable = true;
  defaultOptions = [ "--reverse" "--border" ];
};
```

**File Symlinking** (neovim.nix, hammerspoon.nix):
```nix
xdg.configFile."nvim" = {
  source = ../files/nvim;
  recursive = true;
};
```

### Platform Differences
- **Linux**: Only imports common.nix
- **macOS**: Imports common.nix + hammerspoon.nix (macOS-only window manager)
- **Architecture**: Separate flake outputs handle Intel vs Apple Silicon

### Configuration Management
1. **Nix modules** define program enablement and basic settings
2. **Files directory** contains detailed application configurations  
3. Modules link to files using `source = ../files/[app]` pattern
4. All changes require `nix run . -- switch --flake .#[platform]` to apply

### Adding New Tools
1. Create module in `modules/[tool].nix` 
2. Add to imports in `modules/common.nix`
3. Place config files in `files/[tool]/` if needed
4. Apply configuration with platform-specific command
