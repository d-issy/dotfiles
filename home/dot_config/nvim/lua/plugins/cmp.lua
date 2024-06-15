return {
  "hrsh7th/nvim-cmp",
  dependencies = {
    "hrsh7th/cmp-nvim-lsp",
    "hrsh7th/cmp-nvim-lsp-signature-help",
    "hrsh7th/cmp-path",
    "lsp-zero.nvim",
    "LuaSnip",
    "saadparwaiz1/cmp_luasnip",
  },
  event = { "InsertEnter" },
  opts = function()
    local cmp = require "cmp"
    return {
      sources = cmp.config.sources {
        { name = "luasnip" },
        { name = "nvim_lsp" },
        { name = "nvim_lsp_signature_help" },
        { name = "path" },
      },
      mapping = cmp.mapping.preset.insert {
        ["<Tab>"] = cmp.mapping.confirm { select = false },
      },
      snippet = {
        expand = function(args)
          require("luasnip").lsp_expand(args.body)
        end,
      },
    }
  end,
}
