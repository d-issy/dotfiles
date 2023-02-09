return {
  -- lsp config
  {
    'neovim/nvim-lspconfig',
    event = { 'BufReadPre', 'BufNewFile', 'VeryLazy' },
    dependencies = {
      'williamboman/mason.nvim',
      'williamboman/mason-lspconfig.nvim',
      'neovim/nvim-lspconfig',
      'hrsh7th/cmp-nvim-lsp',
    },
    opts = {
      ensure_installed = { 'sumneko_lua' },
      servers = {
        sumneko_lua = {
          settings = {
            Lua = {
              diagnostics = { globals = { 'vim', 'hs' } },
              workspace = {
                library = vim.api.nvim_get_runtime_file('', true),
                checkThirdParty = false,
              },
              telemetry = { enable = false },
            },
          },
        },
        gopls = { format = true },
        pyright = {
          settings = {
            python = {
              analysis = {
                autoImportCompletions = true,
                autoSearchPaths = true,
                diagnosticMode = 'workspace',
                useLibraryCodeForTypes = true,
              },
            },
          },
        },
      },
    },
    config = function(_, opts)
      require('mason').setup {}
      require('mason-lspconfig').setup {
        ensure_installed = opts.ensure_installed or {},
      }

      require('mason-lspconfig').setup_handlers {
        function(name)
          local lsp_opts = opts.servers[name] or {}
          lsp_opts.capabilities = require('cmp_nvim_lsp').default_capabilities(
            vim.lsp.protocol.make_client_capabilities()
          )

          lsp_opts.on_attach = function(client, buffer)
            local key_opts = { silent = true, buffer = buffer }
            vim.keymap.set(
              'n',
              '<leader>cf',
              function() vim.lsp.buf.format { async = true } end,
              key_opts
            )
            client.server_capabilities.documentFormattingProvider = lsp_opts.format
              or false
          end

          require('lspconfig')[name].setup(lsp_opts)
        end,
      }
    end,
  },

  -- formatters
  {
    'jose-elias-alvarez/null-ls.nvim',
    event = {
      'BufReadPre',
      'BufNewFile',
    },
    dependencies = {
      'mason.nvim',
    },
    opts = function()
      local nls = require 'null-ls'
      return {
        sources = {
          nls.builtins.formatting.stylua,
          nls.builtins.formatting.black,
          nls.builtins.formatting.isort,
          nls.builtins.formatting.prettierd.with {
            filetypes = {
              'css',
              'html',
              'javascript',
              'javascriptreact',
              'sass',
              'typescript',
              'typescriptreact',
              'yaml',
            },
          },
          nls.builtins.diagnostics.cspell.with {
            diagnostics_postprocess = function(diagnostic)
              diagnostic.severity = vim.diagnostic.severity['INFO']
            end,
            extra_args = {
              '--config',
              vim.call('expand', '~/.config/cspell.config.yaml'),
            },
          },
          nls.builtins.code_actions.cspell,
        },
      }
    end,
  },

  -- cmd line tools and lsp servers
  -- @cspell: words sumneko,stylua,pyright,isort,prettierd
  {
    'williamboman/mason.nvim',
    cmd = 'Mason',
    keys = {
      {
        '<leader>cm',
        '<cmd>Mason<cr>',
        desc = 'Mason',
      },
    },
    opts = {
      ensure_installed = {
        'stylua',
        'black',
        'isort',
        'prettierd',
        'cspell',
      },
    },
    config = function(_, opts)
      require('mason').setup(opts)
      local mr = require 'mason-registry'
      for _, tool in ipairs(opts.ensure_installed) do
        local p = mr.get_package(tool)
        if not p:is_installed() then
          p:install()
        end
      end
    end,
  },
}
