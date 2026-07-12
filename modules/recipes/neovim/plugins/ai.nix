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
    local function check_copilot_auth(attempt)
      local client = require("copilot.client")
      if not client.initialized then
        if attempt < 20 then
          vim.defer_fn(function() check_copilot_auth(attempt + 1) end, 250)
        end
        return
      end

      local auth = require("copilot.auth")
      auth.is_authenticated(function()
        if not auth.is_authenticated() then
          vim.notify(
            "GitHub Copilot is not authenticated.\nRun `:Copilot auth` to enable completions.",
            vim.log.levels.WARN,
            { title = "Copilot login required" }
          )
        end
      end)
    end

    vim.defer_fn(function() check_copilot_auth(1) end, 250)
  '';
}
