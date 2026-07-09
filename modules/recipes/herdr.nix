{ pkgs, ... }:

{
  dot.programs.scripts.hr = {
    enable = true;
    commandName = "hr";
    repoSwitcher.includeParentDirectories = true;
  };

  dot.programs.herdr = {
    enable = true;

    repoSwitcher = {
      enable = true;
      includeParentDirectories = true;
    };

    settings = {
      onboarding = false;
      terminal.default_shell = "${pkgs.nushell}/bin/nu";

      keys = {
        prefix = "ctrl+q";
        settings = "prefix+shift+s";
        split_vertical = "prefix+quote";
        split_horizontal = "prefix+double_quote";
      };

      ui = {
        pane_borders = true;
        pane_gaps = true;
        show_agent_labels_on_pane_borders = true;

        toast.delivery = "herdr";
      };

      theme = {
        name = "catppuccin";
        custom = {
          # Inactive tab text uses overlay0/overlay1 on surface0.
          overlay0 = "#a6adc8";
          overlay1 = "#bac2de";
        };
      };
    };
  };
}
