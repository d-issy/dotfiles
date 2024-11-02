{ config, pkgs, lib, ... }:

with lib;

let
  yamlFormat = pkgs.formats.yaml { };
  settings = {
    style = {
      tag = {
        color = "cyan";
        with_percentage = 26;
        min_width = 20;
      };
      comments = {
        color = "blue";
        with_percentage = 42;
        min_width = 45;
      };
      snippet.color = "white";
    };
    finder = {
      command = "fzf";
      overrides = "--no-exact --tiebreak chunk,begin,length";
      overrides_var = "--no-exact";
    };
    cheats.paths = [
      "~/cheats/"
    ];
    shell.command = "zsh";
  };
in
{
  config = {
    home.packages = [ pkgs.navi ];

    programs.zsh.initExtra = ''
      eval "$(${pkgs.navi}/bin/navi widget zsh)"

      function nv() {
        cmd=$(${pkgs.navi}/bin/navi --print)

        if [ -z "$cmd" ]; then
          return
        fi

        $SHELL --login -i -c "$cmd"

        echo
        echo "(process exit)"
        read -k 1
      }
    '';

    programs.nushell = {
      extraConfig = ''
        export def navi_widget [] {
          let input = (commandline)
          let last_command = ($input | navi fn widget::last_command | str trim)

          match ($last_command | is-empty) {
            true => {^navi --print | complete | get "stdout"}
            false => {
              let find = $"($last_command)_NAVIEND"
              let replacement = (^navi --print --query $'($last_command)' --best-match | complete | get "stdout")

              match ($replacement | str trim | is-empty) {
                false => {$"($input)_NAVIEND" | str replace $find $replacement}
                true => $input
              }
            }
          } 
          | str trim
          | commandline edit --replace $in

          commandline set-cursor --end
        }

        let nav_keybinding = {
          name: "navi",
          modifier: control,
          keycode: char_g,
          mode: [emacs, vi_normal, vi_insert],
          event: {
            send: executehostcommand,
            cmd: navi_widget,
          }
        }

        $env.config.keybindings = ($env.config.keybindings | append $nav_keybinding)
      '';
    };

    xdg.configFile."navi/config.yaml" = mkIf (settings != { }) {
      source = yamlFormat.generate "navi-config" settings;
    };

    home.file."cheats" = {
      source = ../files/cheats;
      recursive = true;
    };
  };
}
