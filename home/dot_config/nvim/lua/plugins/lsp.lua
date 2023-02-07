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
      }
    },
    config = function(_, opts)
      require('mason').setup {}
      require('mason-lspconfig').setup {
        ensure_installed = opts.ensure_installed
      }
    end
  }
}
