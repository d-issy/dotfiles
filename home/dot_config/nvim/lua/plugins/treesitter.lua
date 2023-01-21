return {
  'nvim-treesitter/nvim-treesitter',
  dependencies = {
    { 'lukas-reineke/indent-blankline.nvim',
      opts = {
        char = "▏",
        show_current_context = true
      }
    }
  },
  event = 'BufReadPost',
  config = function()
    require 'nvim-treesitter.configs'.setup({
      highlight = { enable = true },
      indent = { enable = true },
      ensure_installed = { 'vim', 'help', 'lua' }
    })
  end
}
