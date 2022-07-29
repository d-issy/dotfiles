local map = vim.keymap.set
local opts = { noremap = true, silent = true }

vim.g.mapleader = ' '

-- normal
map('n', 'gT', ':BufferLineCyclePrev<CR>', opts)
map('n', 'gt', ':BufferLineCycleNext<CR>', opts)

-- leader
map('n', '<Leader>e', ':Neotree reveal float<CR>', opts)
map('n', '<Leader>w', ':w<CR>', opts)

-- telescope
local status_ok, _ = pcall(require, 'telescope')
if status_ok then
  local builtin = require 'telescope.builtin'
  local themes = require 'telescope.themes'

  local no_preview_theme = themes.get_dropdown({ previewer = false })
  map('n', '<Leader>p', function() builtin.find_files(no_preview_theme) end, opts)
  map('n', '<Leader>P', builtin.commands, opts)
end
