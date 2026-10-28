{
  config,
  lib,
  pkgs,
  ...
}:

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
        inherit (config) home;
        cfg = config.programs.nushell;
      in
      {
        enable = true;
        loadSessionVariables = true;
        shellAliases = home.shellAliases // alias;
        environmentVariables = home.sessionVariables // environments;

        inherit nuConfig;

        extraEnv = ''
          # Do not rely on system shell initialization, which macOS updates can reset.
          $env.PATH = (
            $env.PATH
            | prepend [
              ($env.HOME | path join ".local" "bin")
              "${config.home.profileDirectory}/bin"
              "/nix/var/nix/profiles/default/bin"
            ]
            | uniq
          )
        '';

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
        inherit (jsonFormat) type;
      };
    };
}
