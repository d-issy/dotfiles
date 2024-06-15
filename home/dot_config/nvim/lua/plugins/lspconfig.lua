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
      -- default
      lsp_zero.default_keymaps { bufnr = bufnr }

      -- custom
      local function map(l, r, desc)
        vim.keymap.set("n", l, r, { buffer = bufnr, desc = desc, silent = true })
      end
      map("<leader>cr", "<cmd>lua vim.lsp.buf.rename()<cr>", "LSP Rename")
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
