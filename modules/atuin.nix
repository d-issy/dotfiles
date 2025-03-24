{ config, pkgs, ... }:

{
  config = {
    programs.atuin = {
      enable = true;
      settings = {
        show_preview = true;
        style = "full";
        filter_mode_shell_up_key_binding = "session";
        workspaces = true;
        history_filter = [
          "^_"
          "^set-env "
          "^export "
        ];
      };
    };
  };
}
