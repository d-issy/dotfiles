return {
  "saghen/blink.cmp",
  version = "*",
  event = { "InsertEnter" },
  dependencies = {
    "giuxtaposition/blink-cmp-copilot",
    "zbirenbaum/copilot.lua",
  },
  opts = {
    keymap = {
      preset = "super-tab",
    },
    completion = {
      accept = {
        auto_brackets = {
          enabled = true,
        },
      },
      documentation = {
        auto_show = true,
        auto_show_delay_ms = 200,
        window = {
          border = "rounded",
        },
      },
      menu = {
        border = "rounded",
        draw = {
          treesitter = { "lsp" },
          columns = { { "label", "label_description", gap = 1 }, { "kind" } },
          components = {
            kind_icon = { with = { fill = true } },
          },
        },
      },
      ghost_text = {
        enabled = true,
      },
    },
    sources = {
      completion = {
        enabled_providers = { "lsp", "path", "copilot" },
      },
      providers = {
        copilot = {
          name = "Copilot",
          module = "blink-cmp-copilot",
          transform_items = function(_, items)
            local CompletionItemKind = require("blink.cmp.types").CompletionItemKind
            local kind_idx = #CompletionItemKind + 1
            CompletionItemKind[kind_idx] = "Copilot"
            for _, item in ipairs(items) do
              item.kind = kind_idx
            end
            return items
          end,
        },
      },
    },
    signature = {
      enabled = true,
      window = {
        border = "rounded",
      },
    },
  },
}
