-- lsp basics
local map = vim.keymap.set
local on_attach = function(_, bufnr)
  vim.api.nvim_buf_set_option(bufnr, 'omnifunc', 'v:lua.vim.lsp.omnifunc')

  local opts = { noremap = true, silent = true, buffer = bufnr }

  map('n', '<leader>f', vim.lsp.buf.formatting, opts)
  map('n', '<leader>d', vim.diagnostic.open_float, opts)
  map('n', 'gd', vim.lsp.buf.definition, opts)
  map('n', 'K', vim.lsp.buf.hover, opts)
end

local capabilities = require 'cmp_nvim_lsp'.update_capabilities(vim.lsp.protocol.make_client_capabilities())
require 'nvim-lsp-installer'.setup { automatic_installation = true }

require 'lspconfig'.sumneko_lua.setup {
  on_attach = on_attach,
  capabilities = capabilities,
  settings = {
    Lua = {
      diagnostics = {
        globals = {
          'require',
          'vim',
          'hs',
        }
      }
    }
  }
}

require 'lspconfig'.gopls.setup { capabilities = capabilities, on_attach = on_attach }
require 'lspconfig'.pyright.setup { capabilities = capabilities, on_attach = on_attach }
require 'lspconfig'.rust_analyzer.setup { capabilities = capabilities, on_attach = on_attach }
require 'lspconfig'.tsserver.setup { capabilities = capabilities, on_attach = on_attach }

-- lspkind
require('lspkind').init {
  -- default: 'symbol'
  -- options: 'text', 'text_symbol', 'symbol_text', 'symbol'
  mode = 'symbol_text',

  -- default: 'default'
  -- options: 'default', 'codicons'
  preset = 'codicons',

  symbol_map = {
    Text = "",
    Method = "",
    Function = "",
    Constructor = "",
    Field = "ﰠ",
    Variable = "",
    Class = "ﴯ",
    Interface = "",
    Module = "",
    Property = "ﰠ",
    Unit = "塞",
    Value = "",
    Enum = "",
    Keyword = "",
    Snippet = "",
    Color = "",
    File = "",
    Reference = "",
    Folder = "",
    EnumMember = "",
    Constant = "",
    Struct = "פּ",
    Event = "",
    Operator = "",
    TypeParameter = ""
  },
}

-- lspsaga
local lspsaga = require 'lspsaga'
local opts = { noremap = true, silent = true }

lspsaga.init_lsp_saga()

map('n', '<leader>r', require 'lspsaga.rename'.rename, opts)
map('n', 'gh', require 'lspsaga.codeaction'.code_action, opts)
map('n', 'K', require 'lspsaga.hover'.render_hover_doc, opts)
