return {
  -- "hrsh7th/nvim-cmp",
  "iguanacucumber/magazine.nvim",
  name = "nvim-cmp",
  version = "0.3", -- 0.4 is verry buggy
  dependencies = {
    "hrsh7th/cmp-nvim-lsp",
    "hrsh7th/cmp-path",
    "copilot-cmp",
    "lsp-zero.nvim",
    "LuaSnip",
  },
  event = { "InsertEnter" },
  opts = function()
    local cmp = require "cmp"
    local border = require "util.border"

    return {
      cmpletion = {
        completeopt = "menu,menuone,noinsert,noselect",
      },
      sources = cmp.config.sources {
        { name = "nvim_lsp", group_index = 1 },
        { name = "path", group_index = 1 },
        {
          name = "copilot",
          group_index = 2,
          entry_filter = function()
            return require("util.copilot").enabled()
          end,
        },
      },
      mapping = cmp.mapping.preset.insert {
        ["<Tab>"] = cmp.mapping.confirm { select = false },
      },
      sorting = {
        priority_weight = 3,
        comparators = {
          cmp.config.compare.length,
          cmp.config.compare.offset,
          cmp.config.compare.kind,
          cmp.config.compare.locality,
          cmp.config.compare.order,
        },
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
      experimental = {
        ghost_text = {
          hl_group = "GmpGhostText",
        },
      },
    }
  end,
}
