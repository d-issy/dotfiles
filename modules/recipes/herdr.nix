{ pkgs, ... }:

{
  dot = {
    programs = {
      scripts.hr = {
        enable = true;
        commandName = "hr";
        repoSwitcher.includeParentDirectories = true;
      };

      herdr = {
        enable = true;

        repoSwitcher = {
          enable = true;
          includeParentDirectories = true;
        };

        settings = {
          experimental.switch_ascii_input_source_in_prefix = true;
          onboarding = false;
          terminal.default_shell = "${pkgs.nushell}/bin/nu";

          keys = {
            prefix = "ctrl+q";
            settings = "prefix+shift+s";
            split_vertical = "prefix+quote";
            split_horizontal = "prefix+double_quote";
          };

          ui = {
            hide_tab_bar_when_single_tab = true;
            pane_borders = true;
            pane_gaps = true;
            prompt_new_tab_name = false;
            show_agent_labels_on_pane_borders = true;

            sound.enabled = false;
            toast = {
              clipboard.position = "bottom-left";
              delivery = "herdr";
              herdr.position = "bottom-left";
            };
          };

          theme = {
            name = "catppuccin";
            custom = {
              surface_dim = "#313244";
              surface0 = "#45475a";

              # Inactive tab text uses overlay0/overlay1 on surface0.
              overlay0 = "#a6adc8";
              overlay1 = "#bac2de";
            };
          };
        };
      };
    };

    xdg.configFile."herdr/agent-detection/pi.toml".source = true;
  };
}
