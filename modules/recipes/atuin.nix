{
  config,
  lib,
  pkgs,
  ...
}:

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

      # Atuin's generated Nushell config names both its Ctrl-R and Up bindings
      # `atuin`, which Nushell warns about. Generate it with a distinct Up name.
      enableNushellIntegration = false;
    };

    nushell.extraConfig = mkMerge [
      (mkOrder 2000 ''
        source ${
          pkgs.runCommand "atuin-nushell-config.nu"
            {
              nativeBuildInputs = [
                pkgs.writableTmpDirAsHomeHook
                pkgs.gawk
              ];
            }
            ''
              ${lib.getExe config.programs.atuin.package} init nu | awk '
                /name: atuin/ {
                  count++
                  if (count == 2) sub("name: atuin", "name: atuin_up")
                }
                { print }
              ' > "$out"
            ''
        }
      '')
      # This calls _atuin_search_cmd from the generated config above.
      (mkOrder 2100 ''
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
      '')
    ];
  };
}
