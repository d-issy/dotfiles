vim.opt.backup = false
vim.opt.writebackup = false
vim.opt.ignorecase = true
vim.opt.smartcase = true
vim.opt.cmdheight = 2
vim.opt.termguicolors = true
vim.opt.mouse = 'a'

vim.opt.wrap = false
vim.opt.completeopt = { 'menu', 'menuone', 'noselect' }

vim.opt.autoindent = true
vim.opt.smartindent = true
vim.opt.expandtab = true
vim.opt.breakindent = true

vim.opt.shiftwidth = 2
vim.opt.softtabstop = 2
vim.opt.tabstop = 2

vim.opt.path:append { '**' }

vim.opt.list = true
vim.opt.listchars = { tab = '>-', trail = '•', nbsp = '_' }
