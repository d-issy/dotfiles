local servers = {
  lua_ls = {
    settings = {
      Lua = {
        workspace = {
          library = vim.api.nvim_get_runtime_file("", true),
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
    "telescope.nvim",
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

      -- keymaps
      lsp_zero.default_keymaps { bufnr = bufnr }

      local function map(l, r, desc)
        vim.keymap.set("n", l, r, { buffer = bufnr, desc = desc, silent = true })
      end

      map("<leader>cr", "<cmd>lua vim.lsp.buf.rename()<cr>", "LSP Rename")
      map("<leader>ca", "<cmd>lua vim.lsp.buf.code_action()<cr>", "LSP CodeAction")
      map("<leader>cs", "<cmd>Telescope lsp_document_symbols<cr>", "LSP Symbols")
      map("gr", "<cmd>Telescope lsp_references<cr>", "LSP References")
      map("gd", "<cmd>Telescope lsp_definitions<cr>", "LSP Defenition")

      -- goto
      local goto_opts = { popup_opts = { border = "single" } }

      local function goto_prev()
        if vim.diagnostic.get_prev() then
          vim.diagnostic.goto_prev(goto_opts)
        end
      end
      map("[d", goto_prev, "LSP Prev Diagnostic")

      local function goto_next()
        if vim.diagnostic.get_next() then
          vim.diagnostic.goto_next(goto_opts)
        end
      end
      map("]d", goto_next, "LSP Next Diagnostic")

      -- signature help
      vim.keymap.set("i", "<C-h>", function()
        vim.lsp.buf.signature_help()
      end, { buffer = bufnr, remap = false })
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
