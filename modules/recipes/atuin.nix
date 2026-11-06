{ lib, ... }:

with lib;

{
  config.programs = {
    atuin = {
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

      enableNushellIntegration = true;
    };

    # Load after Home Manager's Atuin integration, which defines _atuin_search_cmd.
    nushell.extraConfig = mkOrder 2100 ''
      $env.config = (
        $env.config | upsert keybindings (
          $env.config.keybindings | append {
            name: atuin_search
            modifier: control
            keycode: char_p
            mode: [emacs, vi_normal, vi_insert]
            event: { send: executehostcommand cmd: (_atuin_search_cmd "--shell-up-key-binding") }
          }
        )
      )
    '';
  };
}
