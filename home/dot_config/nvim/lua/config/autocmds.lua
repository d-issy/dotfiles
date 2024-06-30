local function augroup(name)
  return vim.api.nvim_create_augroup(name, { clear = true })
end

-- save to auto chezmoi apply when change
local chezmoi = require "util.chezmoi"
vim.api.nvim_create_autocmd("BufWritePost", {
  group = augroup "chezmoi_update",
  pattern = chezmoi.pattern,
  callback = chezmoi.apply,
})

-- highlight when yank
vim.api.nvim_create_autocmd("TextYankPost", {
  group = augroup "highlight_yank",
  callback = function()
    vim.highlight.on_yank()
  end,
})

-- close some filetypes with <q>
vim.api.nvim_create_autocmd("FileType", {
  group = augroup "close_with_q",
  pattern = {
    "help",
    "notify",
    "qf",
  },
  callback = function(event)
    vim.bo[event.buf].buflisted = false
    vim.keymap.set("n", "q", "<cmd>close<cr>", { buffer = event.buf, silent = true })
  end,
})

-- terminal mode
vim.api.nvim_create_autocmd({ "TermOpen", "WinEnter" }, {
  group = augroup "terminal_open",
  pattern = "term://*",
  callback = function()
    vim.cmd "startinsert"
    vim.cmd "setlocal nonumber"
    vim.cmd "setlocal norelativenumber"
  end,
})
