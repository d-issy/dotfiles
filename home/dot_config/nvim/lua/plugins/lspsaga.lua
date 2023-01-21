return {
  'glepnir/lspsaga.nvim',
  branch = 'main',
  opts = { ui = { code_action = '', diagnostic = '' } },
  dependencies = { 'neovim/nvim-lspconfig' },
  keys = {
    { '<leader>f', function() vim.lsp.buf.format { async = true } end },
    { 'gd', '<cmd>Lspsaga lsp_finder<CR>' },
    { 'K', '<cmd>Lspsaga hover_doc<CR>' },
    { '<leader>d', '<cmd>Lspsaga show_line_diagnostics<CR>' },
    { '<leader>h', '<cmd>Lspsaga code_action<CR>' },
    { '<leader>l', '<cmd>Lspsaga outline<CR>' },
    { '<leader>r', '<cmd>Lspsaga rename<CR>' },
    { '<leader>[', '<cmd>Lspsaga diagnostic_jump_prev<CR>' },
    { '<leader>]', '<cmd>Lspsaga diagnostic_jump_next<CR>' },
  }
}
