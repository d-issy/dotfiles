return {
  'neovim/nvim-lspconfig',
  event = { 'BufReadPre', 'BufNewFile' },
  dependencies = {
    { 'folke/neodev.nvim', config = true },
    'williamboman/mason.nvim',
    'williamboman/mason-lspconfig.nvim',
    'hrsh7th/cmp-nvim-lsp',
  },
  opts = function()
    return {
      diagnostics = {
        underline = true,
        update_in_insert = false,
        virtual_text = { spacing = 4, prefix = "●" },
        severity_sort = true,
        float = { source = 'always' },
      },
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
            }
          }
        },
        gopls = {
          settings = { gopls = { analyses = {
            unusedparams = true,
            shadow = true,
            staticcheck = true,
          } } },
          init_options = { usePlaceholders = true }
        },
        pyright = {
          settings = { python = { analysis = {
            autoImportCompletions = true,
            autoSearchPaths = true,
            diagnosticMode = 'workspace',
            useLibraryCodeForTypes = true,
          } } }
        },
        denols = { root_dir = require('lspconfig').util.root_pattern('deno.json'), },
        cssls = {},
        emmet_ls = {},
        html = {},
        jsonls = {},
        rust_analyzer = {},
        solargraph = {},
        terraformls = {},
        tsserver = {},
      }
    }
  end,
  config = function(_, opts)
    -- diagnostics
    local signs = { Error = " ", Warning = " ", Hint = " ", Information = " " }
    for name, icon in pairs(signs) do
      local hl = "DiagnosticSign" .. name
      vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = hl })
    end
    vim.diagnostic.config(opts.diagnostics)

    -- lsp setup
    local servers = opts.servers
    local flags = { debounce_text_changes = 150 }
    local capabilities = require 'cmp_nvim_lsp'.default_capabilities(vim.lsp.protocol.make_client_capabilities())
    capabilities.textDocument.completion.completionItem.snippetSupport = true

    local on_attach = function(_, bufnr)
      vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.vim.lsp.omnifunc')
    end

    require 'mason'.setup { ensure_installed = vim.tbl_keys(servers) }
    require 'mason-lspconfig'.setup {}
    require 'mason-lspconfig'.setup_handlers {
      function(server_name)
        local server_opts = servers[server_name] or {}
        server_opts.capabilities = capabilities
        server_opts.flags = flags
        server_opts.on_attach = on_attach
        require('lspconfig')[server_name].setup(server_opts)
      end
    }
  end
}
