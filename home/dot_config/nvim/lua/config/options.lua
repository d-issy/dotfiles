vim.g.mapleader = " "
vim.g.mapleaderlocal = " "

vim.g.root_spec = { "cwd" }
vim.g.autoformat = true

vim.opt.encoding = "utf-8"
vim.opt.fileencoding = "utf-8"

vim.opt.ignorecase = true
vim.opt.smartcase = true

vim.opt.autoindent = true
vim.opt.smartindent = true
vim.opt.breakindent = true
vim.opt.expandtab = true
vim.opt.shiftwidth = 2
vim.opt.shiftround = false

vim.opt.backup = false
vim.opt.writebackup = false

vim.opt.clipboard = ""
vim.opt.cmdheight = 0
vim.opt.hlsearch = true
vim.opt.laststatus = 0
vim.opt.showcmd = true
vim.opt.splitbelow = true
vim.opt.splitkeep = "cursor"
vim.opt.splitright = true
vim.opt.title = true
vim.opt.wrap = false

vim.opt.backspace = { "start", "eol", "indent" }
vim.opt.path:append { "**" }
vim.opt.wildignore:append { "*/node_modules/*" }

vim.opt.fillchars = {
  foldopen = "",
  foldclose = "",
  fold = "⸱",
  foldsep = " ",
  diff = "╱",
  eob = " ",
}

vim.opt.foldlevel = 99
vim.opt.smoothscroll = true
vim.opt.foldexpr = "v:lua.require'lazyvim.util'.ui.foldexpr()"
vim.opt.foldmethod = "expr"
vim.opt.foldtext = ""
