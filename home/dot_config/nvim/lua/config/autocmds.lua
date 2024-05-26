vim.api.nvim_create_autocmd("BufEnter", {
  callback = function()
    if vim.bo.filetype == "" then
      vim.bo.filetype = "markdown"
    end
  end,
})

local chezmoi = require "util.chezmoi"
vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = chezmoi.pattern,
  callback = chezmoi.apply,
})

vim.api.nvim_create_autocmd("FileType", {
  pattern = { "spectre_panel" },
  callback = function() vim.treesitter.stop() end,
})

-- disable auto groups
vim.api.nvim_create_augroup("lazyvim_wrap_spell", { clear = true })
