return {
  {
    'nvim-treesitter/nvim-treesitter',
    build = ':TSUpdate',
    event = { 'BufReadPost', 'BufNewFile', 'VeryLazy' },
    keys = {
      {
        '<leader>ut',
        '<cmd>TSBufToggle highlight<cr>',
        desc = 'Toggle Highlight',
      },
    },
    opts = {
      auto_install = true,
      sync_install = true,
      highlight = { enable = true },
      indent = { enable = true },
      context_commentstring = { enable = true, enable_autocmd = false },
      ensure_installed = {
        'help',
        'vim',
        'lua',
        'markdown',
        'markdown_inline',
      }
    },
    config = function(_, opts) require('nvim-treesitter.configs').setup(opts) end,
  },
}
