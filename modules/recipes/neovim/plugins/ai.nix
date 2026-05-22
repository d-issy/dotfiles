_:

{
  programs.nixvim.plugins = {
    copilot-lua = {
      enable = true;
      lazyLoad.settings.cmd = "Copilot";
      settings = {
        suggestion.enabled = false;
        panel.enabled = false;
        filetypes = {
          markdown = true;
          help = true;
        };
      };
    };

    avante = {
      enable = true;
      settings = {
        provider = "copilot";
        file_selector.provider = "snacks";
        windows = {
          sidebar_header = {
            enabled = true;
            align = "right";
            rounded = false;
          };
          input.prefix = "";
        };
      };
    };
  };
}
