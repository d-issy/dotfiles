return {
  { 'nvim-telescope/telescope.nvim',
    dependencies = { 'nvim-lua/plenary.nvim' },
    lazy = true,
    keys = {
      { '<Leader>p', '<cmd>Telescope find_files<CR>' },
      { '<Leader>P', '<cmd>Telescope commands<CR>' },
    },
    opts = {
      defaults = {
        file_ignore_patterns = {
          '%.DS_Store',
          '%.git/',
          '%.svn/',
          '%.hg/',
          '%.venv/',
          '__pycache__/',
          '%.mypy_cache/',
          '%.pytest_cache/',
          'node_modules/',
          '%.bz2$',
          '%.gz$',
          '%.png$',
          '%.tgz$',
        }
      },
      pickers = {
        buffers = {
          theme = 'dropdown',
          previewer = false,
        },
        find_files = {
          theme = 'dropdown',
          previewer = false,
          find_command = { "rg", "--files", "--hidden" }
        }
      }
    }
  }
}
