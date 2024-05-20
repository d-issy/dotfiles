return {
  "nvim-lspconfig",
  init = function()
    local keys = require("lazyvim.plugins.lsp.keymaps").get()

    -- ui settings
    if vim.fn.has "nvim-0.5.0" == 1 then
      vim.diagnostic.config { float = { border = "rounded" } }
    end

    -- disable signature help keymap
    keys[#keys + 1] = { "<c-k>", false, mode = "i" }
  end,
}
