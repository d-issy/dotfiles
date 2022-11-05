local opts = { noremap = true, silent = true }

vim.g.mapleader = ' '

vim.keymap.set('n', '<Leader>w', ':w<CR>', opts)
