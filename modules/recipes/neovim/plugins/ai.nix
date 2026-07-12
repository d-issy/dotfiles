_:

{
  programs.nixvim.plugins.copilot-lua = {
    enable = true;
    settings = {
      panel.enabled = false;
      suggestion = {
        enabled = true;
        autoTrigger = true;
      };
      filetypes = {
        markdown = true;
        help = true;
      };
    };
  };
}
