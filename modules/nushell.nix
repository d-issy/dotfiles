{ config, lib, pkgs, ... }:

let
  home = config.home;
in
{
  config = {
    programs.nushell = {
      enable = true;

      shellAliases = home.shellAliases // {
        ll = "ls -l";
        la = "ls -la";
      };

      environmentVariables = lib.attrsets.mapAttrs (name: value: ''"${value}"'') (home.sessionVariables // {
        # disable indicator vi
        PROMPT_INDICATOR_VI_NORMAL = "";
        PROMPT_INDICATOR_VI_INSERT = "";
      });

      extraConfig = ''
        $env.config.show_banner = false
        $env.config.edit_mode = "vi"

        $env.config.ls.use_ls_colors = false
        $env.config.cursor_shape.vi_insert = "line"
        $env.config.cursor_shape.vi_normal = "block"
      '';
    };
  };
}
