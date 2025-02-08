local map = require "util.map"

local servers = {
  gopls = {
    settings = {
      gopls = {
        codelenses = {
          generate = true,
          gc_details = true,
          test = true,
          tidy = true,
          upgrade_dependency = true,
          vendor = true,
        },
        hints = {
          assignVariableTypes = false,
          compositeLiteralFields = true,
          compositeLiteralTypes = true,
          constantValues = false,
          functionTypeParameters = true,
          parameterNames = true,
          rangeVariableTypes = false,
        },
      },
    },
  },
  lua_ls = {
    settings = {
      Lua = {
        diagnostics = {
          globals = { "vim", "hs" },
        },
        hint = {
          enable = true,
          arrayIndex = "Disable",
        },
        workspace = {
          library = vim.list_slice(vim.api.nvim_get_runtime_file("", true), 2),
        },
      },
    },
  },
  typos_lsp = {
    init_options = {
      diagnosticSeverity = "Hint",
    },
  },
}

return {
  "neovim/nvim-lspconfig",
  dependencies = {
    "williamboman/mason-lspconfig.nvim",
    "mason.nvim",
    "blink.cmp",
  },
  event = { "BufReadPost" },
  opts = {
    servers = servers,
  },
  config = function(_, opts)
    local border = require("util.border").generate "FloatBorder"

    vim.lsp.inlay_hint.enable()
    vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, { border = border })
    vim.lsp.handlers["textDocument/signatureHelp"] = vim.lsp.with(vim.lsp.handlers.signature_help, { border = border })
    vim.diagnostic.config {
      float = true,
      update_in_insert = true,
      severity_sort = true,
      signs = {
        text = {
          [vim.diagnostic.severity.ERROR] = "✘",
          [vim.diagnostic.severity.WARN] = "▲",
          [vim.diagnostic.severity.HINT] = "⚑",
          [vim.diagnostic.severity.INFO] = "»",
        },
      },
    }

    ---@diagnostic disable: assign-type-mismatch
    local goto_next = function()
      vim.diagnostic.goto_next { float = { border = border } }
    end

    local goto_prev = function()
      vim.diagnostic.goto_prev { float = { border = border } }
    end
    ---@diagnostic enable: assign-type-mismatch

    map.setup {
      { "[d", goto_prev, desc = "LSP Prev Diagnostic" },
      { "]d", goto_next, dsc = "LSP Next Diagnostic" },
      { "<leader>cc", vim.lsp.codelens.run, desc = "Run Codelens" },
      { "<leader>cC", vim.lsp.codelens.refresh, desc = "Run Codelens (Refresh)" },
    }

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
