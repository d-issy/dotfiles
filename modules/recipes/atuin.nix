{ lib, ... }:

with lib;

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

    # Home Manager's Atuin Nushell integration uses mkOrder 2000; this
    # keybinding calls _atuin_search_cmd defined by that integration, so it
    # must be emitted after it.
    programs.nushell.extraConfig = mkOrder 2100 ''
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
