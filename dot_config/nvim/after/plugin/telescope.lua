local status_ok, telescope = pcall(require, 'telescope')
if not status_ok then
  return
end

telescope.setup {
  defaults = {
    file_ignore_patterns = {
      '.DS_Store',
      '.git/',
      '.svn/',
      '.hg/',
      '.venv/',
      '__pycache__/',
      '.mypy_cache/',
      '.pytest_cache/',
      'node_modules/',
      '.bz2$',
      '.gz$',
      '.png$',
      '.tgz$',
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
      hidden = true,
      no_ignore = true,
    }
  },
}

local opts = { noremap = true, silent = true }
local builtin = require 'telescope.builtin'

vim.keymap.set('n', '<Leader>p', builtin.find_files, opts)
vim.keymap.set('n', '<Leader>P', builtin.commands, opts)
