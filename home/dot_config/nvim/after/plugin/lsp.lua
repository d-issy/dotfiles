local status, lspconfig = pcall(require, 'lspconfig')
if not status then return end


local on_attach = function(_, bufnr)
  vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.vim.lsp.omnifunc')

  local opts = { noremap = true, silent = true, buffer = bufnr }

  vim.keymap.set('n', '<leader>f', function() vim.lsp.buf.format { async = true } end, opts)

  status, _ = pcall(require, 'lspsaga')
  if status then
    vim.keymap.set('n', 'gd', '<cmd>Lspsaga lsp_finder<CR>', opts)
    vim.keymap.set('n', 'K', '<cmd>Lspsaga hover_doc<CR>', opts)
    vim.keymap.set('n', '<leader>d', '<cmd>Lspsaga show_line_diagnostics<CR>', opts)
    vim.keymap.set('n', '<leader>h', '<cmd>Lspsaga code_action<CR>', opts)
    vim.keymap.set('n', '<leader>l', '<cmd>Lspsaga outline<CR>', opts)
    vim.keymap.set('n', '<leader>r', '<cmd>Lspsaga rename<CR>', opts)
    vim.keymap.set('n', '<leader>[', '<cmd>Lspsaga diagnostic_jump_prev<CR>', opts)
    vim.keymap.set('n', '<leader>]', '<cmd>Lspsaga diagnostic_jump_next<CR>', opts)
  end
end

local capabilities = vim.lsp.protocol.make_client_capabilities()
local cmp_nvim_lsp_status_ok, cmp_nvim_lsp = pcall(require, 'cmp_nvim_lsp')
if cmp_nvim_lsp_status_ok then
  capabilities = cmp_nvim_lsp.default_capabilities(capabilities)
  capabilities.textDocument.completion.completionItem.snippetSupport = true
end

local flags = { debounce_text_changes = 150 }

lspconfig.sumneko_lua.setup {
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

lspconfig.gopls.setup {
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

lspconfig.pyright.setup {
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

lspconfig.denols.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  flags = flags,
  root_dir = require('lspconfig').util.root_pattern('deno.json'),
}

for _, lsp in ipairs({
  'cssls',
  'emmet_ls',
  'html',
  'jsonls',
  'rust_analyzer',
  'solargraph',
  'terraformls',
  'tsserver',
}) do lspconfig[lsp].setup { on_attach = on_attach, capabilities = capabilities, flags = flags, } end

local signs = { Error = " ", Warning = " ", Hint = " ", Information = " " }
for type, icon in pairs(signs) do
  local hl = "DiagnosticSign" .. type
  vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = hl })
end

vim.diagnostic.config({
  virtual_text = {
    prefix = '●'
  },
  update_in_insert = true,
  float = { source = 'always' },
})
