local chezmoi = require "util.chezmoi"
vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = chezmoi.pattern,
  callback = chezmoi.apply,
})
