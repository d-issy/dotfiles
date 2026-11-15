{ config, ... }:

let
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
  config.programs.nushell =
    let
      inherit (config) home;
    in
    {
      enable = true;
      loadSessionVariables = true;
      shellAliases = home.shellAliases // alias;
      environmentVariables = environments;

      settings = {
        show_banner = false;
        edit_mode = "vi";
        ls.use_ls_colors = false;
        cursor_shape = {
          vi_normal = "block";
          vi_insert = "line";
        };
      };

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
    };
}
