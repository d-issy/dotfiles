return {
  "nvim-lspconfig",
  init = function()
    -- disable signature help keymap
    local keys = require("lazyvim.plugins.lsp.keymaps").get()
    keys[#keys + 1] = { "<c-k>", false, mode = "i" }

    -- ui settings
    if vim.fn.has "nvim-0.5.0" == 1 then
      vim.diagnostic.config { float = { border = "rounded" } }
    end
  end,
  opts = {
    diagnostic = {
      update_in_insert = false,
    },
  },
}
