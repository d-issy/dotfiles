{ config, lib, pkgs, ... }:

with lib;

let
  enable = true;
  nuConfig = {
    show_banner = false;
    edit_mode = "vi";
    ls.use_ls_colors = false;
    cursor_shape = {
      vi_normal = "block";
      vi_insert = "line";
    };
  };

  keybindings = [
    {
      name = "hello";
      modifier = "control";
      keycode = "char_g";
      mode = "vi_insert";
      event = { send = "ExecuteHostCommand"; cmd = "fzf"; };
    }
  ];
in
{
  config = mkIf enable {
    programs.nushell =
      let
        home = config.home;
        cfg = config.programs.nushell;
      in
      {
        enable = true;

        shellAliases = home.shellAliases // {
          ll = "ls -l";
          la = "ls -la";
        };

        environmentVariables = lib.attrsets.mapAttrs (name: value: ''"${value}"'')
          (home.sessionVariables // {
            PROMPT_INDICATOR_VI_NORMAL = "";
            PROMPT_INDICATOR_VI_INSERT = "";
          });

        nuConfig = nuConfig;
        keybindings = keybindings;

        extraConfig = mkIf (cfg.nuConfig != { } || cfg.keybindings != [ ]) ''
          $env.config = ${builtins.toJSON cfg.nuConfig}
          $env.config.keybindings = ${builtins.toJSON cfg.keybindings}
        '';
      };
  };

  options.programs.nushell =
    let
      jsonFormat = pkgs.formats.json { };
      keybindModifierType = types.enum [ "none" "control" "alt" "shift" "shift_alt" "alt_shift" "control_alt" "alt_control" "control_shift" "shift_control" "control_alt_shift" "control_shift_alt" ];
      keybindModeType = types.enum [ "emacs" "vi_normal" "vi_insert" ];
      keybindEventType = types.attrsOf types.anything;
    in
    {
      nuConfig = mkOption {
        type = jsonFormat.type;
        default = { };
      };

      keybindings = mkOption {
        type = types.listOf
          (types.submodule {
            options = {
              name = mkOption { type = types.str; };
              modifier = mkOption { type = keybindModifierType; };
              keycode = mkOption { type = types.str; };
              mode = mkOption { type = types.oneOf [ keybindModeType (types.listOf keybindModeType) ]; };
              event = mkOption {
                type = types.nullOr (types.oneOf [ keybindEventType (types.listOf keybindEventType) ]);
                default = null;
              };
            };
          });
        default = [ ];
      };
    };
}
