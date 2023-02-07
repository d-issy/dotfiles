-- options
vim.opt.backup = false
vim.opt.writebackup = false
vim.opt.ignorecase = true
vim.opt.smartcase = true
vim.opt.cmdheight = 2
vim.opt.termguicolors = true
vim.opt.mouse = "a"

vim.opt.wrap = false
vim.opt.completeopt = { "menu", "menuone", "noselect" }

vim.opt.autoindent = true
vim.opt.smartindent = true
vim.opt.expandtab = true
vim.opt.breakindent = true

vim.opt.shiftwidth = 2
vim.opt.softtabstop = 2
vim.opt.tabstop = 2

vim.opt.path:append({ "**" })

vim.opt.list = true
vim.opt.listchars = { tab = "  ", trail = "•", nbsp = "_" }

-- keys
vim.g.mapleader = " "
local opts = { noremap = true, silent = true }

vim.keymap.set("n", "x", '"_x')
vim.keymap.set("n", "<Leader>w", ":w<CR>", opts)

vim.keymap.set("n", "<Leader>sh", ":split<CR>", opts)
vim.keymap.set("n", "<Leader>sv", ":vsplit<CR>", opts)
vim.keymap.set("n", "<Leader>x", ":close<CR>", opts)

vim.keymap.set("n", "<Leader>tc", ":tabnew<CR>", opts)
vim.keymap.set("n", "<Leader>tn", ":tabnext<CR>", opts)
vim.keymap.set("n", "<Leader>tp", ":tabprevious<CR>", opts)

-- plugins
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
	vim.fn.system({
		"git",
		"clone",
		"--filter=blob:none",
		"https://github.com/folke/lazy.nvim.git",
		"--branch=stable", -- latest stable release
		lazypath,
	})
end
vim.opt.rtp:prepend(lazypath)
require("lazy").setup("plugins")

vim.cmd("colorscheme edge")
