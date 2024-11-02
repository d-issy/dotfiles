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
          $env.config = ($env.config? | ${builtins.toJSON cfg.nuConfig})
        '';
      };
  };

  options.programs.nushell =
    let
      jsonFormat = pkgs.formats.json { };
    in
    {
      nuConfig = mkOption {
        default = { };
        type = jsonFormat.type;
      };
    };
}
