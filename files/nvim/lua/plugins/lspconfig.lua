local map = require "util.map"

return {
  "neovim/nvim-lspconfig",
  dependencies = {
    "mason-org/mason-lspconfig.nvim",
    "mason.nvim",
    "blink.cmp",
  },
  event = { "VeryLazy" },
  config = function()
    local capabilities = require("blink.cmp").get_lsp_capabilities()
    local function configure_lsp(name, config)
      vim.lsp.config(name, vim.tbl_deep_extend("force", { capabilities = capabilities }, config or {}))
    end

    configure_lsp("*", {})
    configure_lsp("lua_ls", require "lsp.lua_ls")
    configure_lsp("gopls", require "lsp.gopls")
    configure_lsp("typos_lsp", require "lsp.typos_lsp")

    vim.lsp.inlay_hint.enable()
    vim.diagnostic.config {
      float = true,
      update_in_insert = true,
      severity_sort = true,
      virtual_lines = { current_line = true },
      signs = {
        text = {
          [vim.diagnostic.severity.ERROR] = "✘",
          [vim.diagnostic.severity.WARN] = "▲",
          [vim.diagnostic.severity.HINT] = "⚑",
          [vim.diagnostic.severity.INFO] = "»",
        },
      },
    }

    require("mason-lspconfig").setup {
      automatic_enable = true,
      automatic_installation = false,
    }

    local jump = function(idx)
      return function()
        vim.diagnostic.jump { count = idx }
      end
    end

    local hover = function()
      vim.lsp.buf.hover { border = "rounded" }
    end

    map.setup {
      { "[d", jump(-1), desc = "LSP Prev Diagnostic" },
      { "]d", jump(1), desc = "LSP Next Diagnostic" },
      { "K", hover, desc = "LSP Hover" },
      { "<leader>cc", vim.lsp.codelens.run, desc = "Run Codelens" },
      { "<leader>cC", vim.lsp.codelens.refresh, desc = "Run Codelens (Refresh)" },
    }
  end,
}
