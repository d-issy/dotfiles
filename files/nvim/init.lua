local lazypath = vim.fn.stdpath "data" .. "/lazy/lazy.nvim"

---@diagnostic disable-next-line: undefined-field
if not vim.uv.fs_stat(lazypath) then
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
vim.g.maplocalleader = "\\"

require("lazy").setup {
  defaults = { lazy = true },
  ui = {
    border = require("util.border").generate(),
  },
  spec = {
    { import = "plugins" },
  },
}

require "config"
