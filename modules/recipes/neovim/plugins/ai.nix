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

  programs.nixvim.extraConfigLua = ''
    vim.defer_fn(function()
      local auth = require("copilot.auth")
      auth.is_authenticated(function(error)
        if not error and not auth.is_authenticated() then
          vim.schedule(function()
            vim.notify(
              "GitHub Copilot is not authenticated.\nRun `:Copilot auth` to enable completions.",
              vim.log.levels.WARN,
              { title = "Copilot login required" }
            )
          end)
        end
      end)
    end, 500)
  '';
}
