return {
  {
    'neovim/nvim-lspconfig',
    event = {'BufReadPre', 'BufNewFile'},
    dependencies = {
      'williamboman/mason.nvim',
      'williamboman/mason-lspconfig.nvim',
      'neovim/nvim-lspconfig',
    },
    opts = {
      ensure_installed = { 'sumneko_lua' },
      servers = {
        sumneko_lua={
          settings = { Lua = {
            diagnostics = {globals={'vim', 'hs'}},
            workspace = {
              library = vim.api.nvim_get_runtime_file('', true),
              checkThirdParty = false,
            },
            telemetry = { enable = false }
          } }
        },
      },
      pyright = {
        settings = {python = {analysis={
          autoImportCompletions=true,
          autoSearchPaths=true,
          diagnosticMode = 'workspace',
          useLibraryCodeForTypes = true,
        }}}
      }
    },
    config = function(_, opts)
      require('mason').setup {}
      require('mason-lspconfig').setup { ensure_installed = opts.ensure_installed or {} }

      require('mason-lspconfig').setup_handlers {
        function(name)
          print(name)
          print(vim.inspect(opts.servers[name] or {}))
          local lsp_opts =  opts.servers[name] or {}
          require('lspconfig')[name].setup(lsp_opts)
        end
      }
      -- require('lspconfig')['sumneko_lua'].setup{
      --   settings = {
      --     Lua = {
      --       diagnostics = {globals={'vim', 'hs'}},
      --       workspace = {
      --         library = vim.api.nvim_get_runtime_file('', true),
      --         checkThirdParty = false,
      --       },
      --       telemetry = { enable = false }
      --     }
      --   }
      -- }
    end
  }
}
