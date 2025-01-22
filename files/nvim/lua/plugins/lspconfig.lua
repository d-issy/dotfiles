local map = require "util.map"

local servers = {
  lua_ls = {
    settings = {
      Lua = {
        workspace = {
          library = vim.list_slice(vim.api.nvim_get_runtime_file("", true), 2),
        },
      },
    },
  },
}

return {
  "VonHeikemen/lsp-zero.nvim",
  dependencies = {
    "neovim/nvim-lspconfig",
    "williamboman/mason-lspconfig.nvim",
    "mason.nvim",
  },
  event = { "BufReadPost" },
  opts = {
    servers = servers,
  },
  config = function(_, opts)
    local lsp_zero = require "lsp-zero"
    local border = require("util.border").generate "FloatBorder"

    vim.diagnostic.config { update_in_insert = true }

    lsp_zero.ui {
      float_border = border,
      sign_text = {
        error = "✘",
        warn = "▲",
        hint = "⚑",
        info = "»",
      },
    }

    lsp_zero.on_attach(function(client, bufnr)
      lsp_zero.default_keymaps { bufnr = bufnr }
      lsp_zero.highlight_symbol(client, bufnr)

      local goto_next = function()
        vim.diagnostic.goto_next {
          float = {
            border = border, ---@diagnostic disable-line: assign-type-mismatch
          },
        }
      end
      local goto_prev = function()
        vim.diagnostic.goto_prev {
          float = {
            border = border, ---@diagnostic disable-line: assign-type-mismatch
          },
        }
      end

      -- stylua: ignore
      map.setup({
        { "[d", goto_prev, desc = "LSP Prev Diagnostic" },
        { "]d", goto_next, dsc = "LSP Next Diagnostic" },
      }, { buffer = bufnr })
    end)

    local handler = function(server)
      local server_opts = opts.servers[server]
      if server_opts then
        require("lspconfig")[server].setup(server_opts)
      else
        local capabilities = require("blink.cmp").get_lsp_capabilities()
        require("lspconfig")[server].setup {
          capabilities = capabilities,
        }
      end
    end

    require("mason-lspconfig").setup {
      handlers = { handler },
    }
  end,
}
