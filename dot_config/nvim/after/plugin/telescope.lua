local status_ok, telescope = pcall(require, 'telescope')
if not status_ok then
  return
end

local fb_actions = telescope.extensions.file_browser.actions

telescope.setup {
  defaults = {
    file_ignore_patterns = {
      '.DS_Store',
      '.git/',
      '.svn/',
      '.hg/',
      '.venv/',
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
  extensions = {
    file_browser = {
      theme = 'dropdown',
      hijack_netrw = true,
      hidden = true,
      respect_gitignore = true,
      mappings = {
        ['i'] = {
          ['<C-w>'] = function() vim.cmd('normal vbd') end,
        },
        ['n'] = {
          ['/'] = function() vim.cmd('startinsert') end,
          ['q'] = function() vim.cmd('close!') end,
          ['a'] = fb_actions.create,
          ['u'] = fb_actions.goto_parent_dir,
        },
      }
    }
  }
}
telescope.load_extension 'file_browser'

local opts = { noremap = true, silent = true }
local builtin = require 'telescope.builtin'

vim.keymap.set('n', '<Leader>b', builtin.buffers, opts)
vim.keymap.set('n', '<Leader>p', builtin.find_files, opts)
vim.keymap.set('n', '<Leader>P', builtin.commands, opts)

vim.keymap.set('n', '<Leader>e', function()
  telescope.extensions.file_browser.file_browser {
    previewer     = false,
    initial_mode  = 'normal',
    layout_config = { height = 40 }
  }
end, opts)
