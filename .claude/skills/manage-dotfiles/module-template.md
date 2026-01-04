# Module Templates

## Simple Module (programs.xxx)

For tools with Home Manager program options:

```nix
{ config, pkgs, ... }:

{
  programs.TOOL_NAME = {
    enable = true;
    # Add settings here
  };
}
```

Example (`modules/gh.nix`):

```nix
{ config, pkgs, ... }:

{
  programs.gh = {
    enable = true;
    settings = {
      git_protocol = "ssh";
    };
    extensions = [
      pkgs.gh-dash
    ];
  };
}
```

## Module with Config Block

For more complex configurations:

```nix
{ config, lib, pkgs, ... }:

with lib;

{
  config = {
    programs.TOOL_NAME = {
      enable = true;
      # settings
    };

    # Additional shell integration
    programs.nushell.extraConfig = mkAfter ''
      # nushell config
    '';
  };
}
```

## Module with External Files

For tools that need config files from `files/`:

```nix
{ config, pkgs, lib, ... }:

{
  config = {
    home.file.".config/TOOL_NAME" = {
      source = ../files/TOOL_NAME;
      recursive = true;
    };
  };
}
```

## Module with Utils (JSON merge)

For tools that need to merge JSON settings:

```nix
{ config, pkgs, lib, ... }:
let
  utils = import ../utils { inherit config pkgs lib; };
  settings = lib.importJSON ../files/APP_NAME/settings.json;
in
{
  config = {
    home.file.".config/APP_NAME" = {
      source = ../files/APP_NAME;
      recursive = true;
    };

    home.activation.appSettings = utils.mergeJson {
      targetDir = "${config.home.homeDirectory}/.config/APP_NAME";
      settingsFile = "settings.json";
      overrides = settings;
    };
  };
}
```

## Adding to common.nix

After creating a module, add it to `modules/common.nix`:

```nix
imports = [
  # ... existing imports
  ./new-module.nix
];
```

## Home Manager Options Reference

Common program options:
- `programs.xxx.enable` - Enable the program
- `programs.xxx.package` - Override package
- `programs.xxx.settings` - Program-specific settings
- `home.file."path"` - Link files to home directory
- `home.packages` - Additional packages to install
- `xdg.configFile."path"` - Link to ~/.config/
