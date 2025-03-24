{ config, pkgs, ... }:

{
  config = {
    programs.atuin = {
      enable = true;
      settings = {
        show_preview = true;
        style = "full";
        inline_height = 15;
        keymap_mode = "vim-insert";
        filter_mode_shell_up_key_binding = "session";
        history_filter = [
          "^_"
          "^set-env "
          "^export "
        ];
      };
    };
  };
}
