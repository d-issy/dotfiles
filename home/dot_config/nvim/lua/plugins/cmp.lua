return {
  "hrsh7th/nvim-cmp",
  dependencies = {
    "hrsh7th/cmp-nvim-lsp",
    "hrsh7th/cmp-path",
    "copilot-cmp",
    "lsp-zero.nvim",
    "LuaSnip",
    "saadparwaiz1/cmp_luasnip",
  },
  event = { "InsertEnter" },
  opts = function()
    local cmp = require "cmp"
    local border = require "util.border"

    return {
      sources = cmp.config.sources {
        { name = "luasnip", group_index = 1 },
        { name = "nvim_lsp", group_index = 1 },
        { name = "path", group_index = 1 },
        { name = "copilot", group_index = 2 },
      },
      mapping = cmp.mapping.preset.insert {
        ["<Tab>"] = cmp.mapping.confirm { select = false },
      },
      snippet = {
        expand = function(args)
          require("luasnip").lsp_expand(args.body)
        end,
      },
      window = {
        documentation = {
          border = border.generate "CmpDocBorder",
          winhighlight = "Normal:CmpDoc",
        },
        completion = {
          border = border.generate "CmpBorder",
        },
      },
    }
  end,
}
