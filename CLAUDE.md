# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Important: Always respond in Japanese when working in this repository.**

## Commands

See @README.md for setup and apply commands.

### GitHub CLI
- `gh pr create` - Creates pull request and pushes branch automatically (no need for separate `git push`)
- Pull request body should not include "Test plan" section - keep it simple

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
