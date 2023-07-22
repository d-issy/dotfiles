return {
  -- lsp config
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile", "VeryLazy" },
    dependencies = {
      "williamboman/mason.nvim",
      "williamboman/mason-lspconfig.nvim",
      "neovim/nvim-lspconfig",
      "hrsh7th/cmp-nvim-lsp",
      "SmiteshP/nvim-navic",
    },
    opts = {
      ensure_installed = { "lua_ls" },
      format = {
        "gopls",
        "rust_analyzer",
      },
      servers = {
        lua_ls = {
          settings = {
            Lua = {
              diagnostics = { globals = { "vim", "hs" } },
              workspace = {
                library = vim.api.nvim_get_runtime_file("", true),
                checkThirdParty = false,
              },
              telemetry = { enable = false },
            },
          },
        },
        pyright = {
          settings = {
            python = {
              analysis = {
                autoImportCompletions = true,
                autoSearchPaths = true,
                diagnosticMode = "workspace",
                useLibraryCodeForTypes = true,
              },
            },
          },
        },
      },
    },
    config = function(_, opts)
      require("mason").setup {}
      require("mason-lspconfig").setup {
        ensure_installed = opts.ensure_installed or {},
      }
      require("mason-lspconfig").setup_handlers {
        function(name)
          local lsp_opts = opts.servers[name] or {}
          lsp_opts.capabilities =
            require("cmp_nvim_lsp").default_capabilities(vim.lsp.protocol.make_client_capabilities())

          lsp_opts.on_attach = function(client, buffer)
            vim.keymap.set("n", "<leader>cf", ":Format<CR>", { silent = true, buffer = buffer })
            client.server_capabilities.documentFormattingProvider = vim.tbl_contains(opts.format, name) or false

            if client.server_capabilities.documentSymbolProvider then
              require("nvim-navic").attach(client, buffer)
            end
          end
          require("lspconfig")[name].setup(lsp_opts)
        end,
      }
    end,
  },

  -- formatters
  {
    "mhartington/formatter.nvim",
    opts = function()
      local util = require "formatter.util"
      return {
        filetype = {
          css = { require("formatter.defaults").prettierd },
          go = { require("formatter.filetypes.go").goimports },
          html = { require("formatter.defaults").prettierd },
          javascript = { require("formatter.defaults").prettierd },
          javascriptreact = { require("formatter.defaults").prettierd },
          json = { require("formatter.defaults").prettierd },
          lua = { require("formatter.filetypes.lua").stylua },
          python = {
            require("formatter.filetypes.python").black,
            require("formatter.filetypes.python").isort,
          },
          rust = {
            require("formatter.filetypes.rust").rustfmt,
          },
          tf = { require("formatter.filetypes.terraform").terraformfmt },
          typescript = { require("formatter.defaults").prettierd },
          typescriptreact = { require("formatter.defaults").prettierd },
          vue = { require("formatter.defaults").prettierd },
          yaml = { require("formatter.defaults").prettierd },
        },
      }
    end,
  },

  -- linters
  {
    "mfussenegger/nvim-lint",
    config = function()
      local lint = require "lint"

      lint.linters.cspell = {
        cmd = "cspell",
        stdin = true,
        ignore_exitcode = true,
        args = {
          "--no-color",
          "--no-progress",
          "--no-summary",
          "--unique",
          "--config",
          vim.call("expand", "~/.config/cspell/cspell.yaml"),
          "--",
          "stdin",
        },
        stream = "stdout",
        parser = require("lint.parser").from_pattern(
          "[^:]+:(%d+):(%d+)%s+-%s+(.+)",
          { "lnum", "lcol", "message" },
          nil,
          { source = "cspell", severity = vim.diagnostic.severity.HINT }
        ),
      }

      lint.linters_by_ft = {
        go = { "cspell" },
        javascript = { "cspell" },
        javascriptreact = { "cspell" },
        make = { "cspell" },
        markdown = { "cspell" },
        python = { "flake8", "cspell" },
        rust = { "cspell" },
        tf = { "cspell" },
        typescript = { "cspell" },
        typescriptreact = { "cspell" },
      }

      vim.api.nvim_create_autocmd(
        { "InsertLeave", "TextChanged", "BufReadPost", "BufNewFile" },
        { callback = function() lint.try_lint() end }
      )
    end,
  },

  -- cmd line tools and lsp servers
  {
    "williamboman/mason.nvim",
    cmd = "Mason",
    keys = {
      {
        "<leader>cm",
        "<cmd>Mason<cr>",
        desc = "Mason",
      },
    },
    opts = {
      ensure_installed = {
        "stylua",
        "black",
        "isort",
        "prettierd",
        "cspell",
      },
    },
    config = function(_, opts)
      require("mason").setup(opts)
      local mr = require "mason-registry"
      for _, tool in ipairs(opts.ensure_installed) do
        local p = mr.get_package(tool)
        if not p:is_installed() then
          p:install()
        end
      end
    end,
  },
}
