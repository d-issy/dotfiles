local map = vim.keymap.set
local opts = { noremap = true, silent = true }

vim.g.mapleader = ' '

-- normal
map('n', 'gT', ':BufferLineCyclePrev<CR>', opts)
map('n', 'gt', ':BufferLineCycleNext<CR>', opts)

-- leader
map('n', '<Leader>w', ':w<CR>', opts)
