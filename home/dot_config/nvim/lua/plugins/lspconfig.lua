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
    lsp_zero.on_attach(function(_, bufnr)
      -- vim.lsp settings
      local border = require("util.border").generate "FloatBorder"

      vim.lsp.handlers["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, {
        border = border,
      })

      vim.lsp.handlers["textDocument/signatureHelp"] = vim.lsp.with(vim.lsp.handlers.signature_help, {
        border = border,
      })
      vim.diagnostic.config { update_in_insert = true }

      -- keymaps
      lsp_zero.default_keymaps { bufnr = bufnr }

      -- goto
      local goto_opts = { popup_opts = { border = "single" } }
      -- stylua: ignore
      local function goto_prev()
        if vim.diagnostic.get_prev() then vim.diagnostic.goto_prev(goto_opts) end
      end
      -- stylua: ignore
      local function goto_next()
        if vim.diagnostic.get_next() then vim.diagnostic.goto_next(goto_opts) end
      end

      -- stylua: ignore
      map.setup({
        { "<C-h>", vim.lsp.buf.signature_help, mode = "i", desc = "LSP Signature Help" },
        { "<leader>cr", vim.lsp.buf.rename, desc = "LSP Rename" },
        { "[d", goto_prev, desc = "LSP Prev Diagnostic" },
        { "]d", goto_next, dsc = "LSP Next Diagnostic" },
      }, { buffer = bufnr })
    end)

    local handler = function(server)
      local server_opts = opts.servers[server]
      if server_opts then
        require("lspconfig")[server].setup(server_opts)
      else
        require("lspconfig")[server].setup {}
      end
    end

    require("mason-lspconfig").setup {
      handlers = { handler },
    }
  end,
}
