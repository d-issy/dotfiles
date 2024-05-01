vim.api.nvim_create_autocmd("BufEnter", {
  callback = function()
    if vim.bo.filetype == "" then
      vim.bo.filetype = "markdown"
    end
  end,
})

-- disable auto groups
vim.api.nvim_create_augroup("lazyvim_wrap_spell", { clear = true })
