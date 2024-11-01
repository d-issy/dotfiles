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
  environments = {
    PROMPT_INDICATOR_VI_NORMAL = "";
    PROMPT_INDICATOR_VI_INSERT = "";
  };
  alias = {
    ll = "ls -l";
    la = "ls -la";
  };
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
        shellAliases = home.shellAliases // alias;
        environmentVariables = home.sessionVariables // environments;

        nuConfig = nuConfig;

        extraConfig = ''
          ${cfg.initExtraFirst}
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
      initExtraFirst = mkOption {
        default = "";
        type = types.lines;
        example = ''
          def hello [name: string] -> string {
            $ "Hello, ($name)!!"
          }
        '';
      };

      nuConfig = mkOption {
        default = { };
        type = jsonFormat.type;
      };

      keybindings = mkOption {
        default = [ ];
        type = types.listOf
          (types.submodule {
            options = {
              name = mkOption { type = types.str; };
              modifier = mkOption {
                default = "control";
                type = keybindModifierType;
              };
              keycode = mkOption {
                type = types.str;
                example = "char_a";
              };
              mode = mkOption {
                default = "vi_insert";
                type = types.oneOf [ keybindModeType (types.listOf keybindModeType) ];
              };
              event = mkOption {
                default = null;
                type = types.nullOr (types.oneOf [ keybindEventType (types.listOf keybindEventType) ]);
              };
            };
          });
      };
    };
}
