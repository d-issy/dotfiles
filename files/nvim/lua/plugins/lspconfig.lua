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
    "mason-org/mason-lspconfig.nvim",
    "mason.nvim",
    "blink.cmp",
  },
  event = { "BufReadPost" },
  opts = {
    servers = servers,
  },
  config = function(_, opts)
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
      { "]d", jump(1), dssc = "LSP Next Diagnostic" },
      { "K", hover, desc = "LSP Hover" },
      { "<leader>cc", vim.lsp.codelens.run, desc = "Run Codelens" },
      { "<leader>cC", vim.lsp.codelens.refresh, desc = "Run Codelens (Refresh)" },
    }

    local capabilities = require("blink.cmp").get_lsp_capabilities()
    for server_name, server_opts in pairs(opts.servers) do
      server_opts.capabilities = capabilities
      require("lspconfig")[server_name].setup(server_opts)
    end
  end,
}
