-- lsp basics
local on_attach = function(_, bufnr)
  vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.vim.lsp.omnifunc')

  local opts = { noremap = true, silent = true, buffer = bufnr }

  -- key mapping
  vim.keymap.set('n', '<leader>f', function() vim.lsp.buf.format { async = true } end, opts)

  local status_ok, _ = pcall(require, 'lspsaga')
  if status_ok then
    vim.keymap.set('n', 'gd', '<cmd>Lspsaga lsp_finder<CR>', opts)
    vim.keymap.set('n', 'K', '<cmd>Lspsaga hover_doc<CR>', opts)
    vim.keymap.set('n', '<leader>d', '<cmd>Lspsaga show_line_diagnostics<CR>', opts)
    vim.keymap.set('n', '<leader>h', '<cmd>Lspsaga code_action<CR>', opts)
    vim.keymap.set('n', '<leader>r', '<cmd>Lspsaga rename<CR>', opts)
    vim.keymap.set('n', '<leader>[', '<cmd>Lspsaga diagnostic_jump_next<CR>', opts)
    vim.keymap.set('n', '<leader>]', '<cmd>Lspsaga diagnostic_jump_prev<CR>', opts)
  end
end

local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities = require 'cmp_nvim_lsp'.default_capabilities(capabilities)
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

local flags = {
  debounce_text_changes = 150
}

require 'lspconfig'.sumneko_lua.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
  settings = {
    Lua = {
      diagnostics = {
        globals = { 'vim', 'hs' }
      },
      workspace = {
        library = vim.api.nvim_get_runtime_file('', true),
        checkThirdParty = false,
      },
      telemetry = {
        enable = false,
      },
    }
  }
}

require 'lspconfig'.html.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
}

require 'lspconfig'.cssls.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
}

require 'lspconfig'.emmet_ls.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
}

require 'lspconfig'.jsonls.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
}

require 'lspconfig'.denols.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
  root_dir = require('lspconfig').util.root_pattern('deno.json'),
}

require 'lspconfig'.gopls.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
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

require 'lspconfig'.terraformls.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
}

require 'lspconfig'.rust_analyzer.setup { on_attach = on_attach, capabilities = capabilities }
require 'lspconfig'.solargraph.setup { on_attach = on_attach, capabilities = capabilities }
require 'lspconfig'.tsserver.setup { on_attach = on_attach, capabilities = capabilities }
