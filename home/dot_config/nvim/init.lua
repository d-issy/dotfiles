local lazypath = vim.fn.stdpath "data" .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system {
    "git",
    "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  }
end

vim.opt.rtp:prepend(lazypath)

vim.g.mapleader = " "
vim.g.mapleaderlocal = " "

require("lazy").setup {
  defaults = { lazy = true },
  spec = {
    { import = "plugins" },
  },
}

pcall(require, "config.options")
