local status_ok, telescope = pcall(require, 'telescope')
if not status_ok then
  return
end

telescope.setup {
  extensions = {
    file_browser = {
      theme = 'dropdown',
      hijack_netrw = true,
      mappings = {
        ['i'] = {
          ['<C-w>'] = function() vim.cmd 'normal vbd' end,
        },
        ['n'] = {
        },
      }
    }
  }
}
telescope.load_extension 'file_browser'


local map = vim.keymap.set
local opts = { noremap = true, silent = true }

local builtin = require 'telescope.builtin'
local themes = require 'telescope.themes'

local no_preview_theme = themes.get_dropdown({ previewer = false })

map('n', '<Leader>p', function() builtin.find_files(no_preview_theme) end, opts)
map('n', '<Leader>P', builtin.commands, opts)

map('n', '<Leader>e', function()
  telescope.extensions.file_browser.file_browser {
    previewer     = false,
    initial_mode  = 'normal',
    layout_config = { height = 40 }
  }
end, opts)
