-- lsp basics
local map = vim.keymap.set
local on_attach = function(_, bufnr)
  vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.vim.lsp.omnifunc')

  local opts = { noremap = true, silent = true, buffer = bufnr }

  map('n', '<leader>f', vim.lsp.buf.formatting, opts)
  -- map('n', '<leader>d', vim.diagnostic.open_float, opts)
end

local capabilities = require 'cmp_nvim_lsp'.update_capabilities(vim.lsp.protocol.make_client_capabilities())
capabilities.textDocument.completion.completionItem.snippetSupport = true

vim.diagnostic.config({
  virtual_text = {
    prefix = '●'
  },
  update_in_insert = true,
})

local mason_status_ok, mason = pcall(require, 'mason')
if mason_status_ok then
  mason.setup {}
end

local mason_lspconfig_status_ok, mason_lspconfig = pcall(require, 'mason-lspconfig')
if mason_lspconfig_status_ok then
  mason_lspconfig.setup { automatic_installation = true }
end

local lsp_flags = {
  debounce_text_changes = 150
}

require 'lspconfig'.sumneko_lua.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = lsp_flags,
  settings = {
    Lua = {
      diagnostics = {
        globals = { 'vim', 'hs' }
      },
      workspace = {
        library = vim.api.nvim_get_runtime_file('', true)
      },
      telemetry = {
        enable = false,
      },
    }
  }
}

require 'lspconfig'.gopls.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = lsp_flags,
  settings = {
    gopls = {
      analyses = {
        unusedparams = true,
        shadow = true,
        staticcheck = true,
      }
    }
  },
  init_options = {
    usePlaceholders = true,
  }
}

require 'lspconfig'.pyright.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  settings = {
    python = {
      analysis = {
        autoImportCompletions = true,
        autoSearchPaths = true,
        diagnosticMode = 'workspace',
        useLibraryCodeForTypes = true,
      }
    }
  }
}

require 'lspconfig'.rust_analyzer.setup { on_attach = on_attach, capabilities = capabilities }
require 'lspconfig'.tsserver.setup { on_attach = on_attach, capabilities = capabilities }
