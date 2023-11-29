return {
  "nvim-lspconfig",
  init = function()
    local keys = require("lazyvim.plugins.lsp.keymaps").get()

    -- disable signature help keymap
    keys[#keys + 1] = { "<c-k>", false, mode = "i" }
  end,
}
