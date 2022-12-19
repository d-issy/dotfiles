vim.g.mapleader = ' '
local opts = { noremap = true, silent = true }

vim.keymap.set('n', 'x', '"_x')
vim.keymap.set('n', '<Leader>w', ':w<CR>', opts)

vim.keymap.set('n', '<Leader>sh', ':split<CR>', opts)
vim.keymap.set('n', '<Leader>sv', ':vsplit<CR>', opts)
vim.keymap.set('n', '<Leader>x', ':close<CR>', opts)

vim.keymap.set('n', '<Leader>tc', ':tabnew<CR>', opts)
vim.keymap.set('n', '<Leader>tn', ':tabnext<CR>', opts)
vim.keymap.set('n', '<Leader>tp', ':tabprevious<CR>', opts)
