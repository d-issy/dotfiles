local function augroup(name)
  return vim.api.nvim_create_augroup(name, { clear = true })
end

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
    "gitsigns.blame",
    "help",
    "neotest-output",
    "neotest-output-panel",
    "neotest-summary",
    "notify",
    "qf",
  },
  callback = function(event)
    vim.bo[event.buf].buflisted = false
    vim.keymap.set("n", "q", "<cmd>close<cr>", { buffer = event.buf, silent = true })
  end,
})

-- bigfile
vim.api.nvim_create_autocmd("BufReadPre", {
  group = augroup "bigfile",
  pattern = "*",
  callback = function(event)
    local file_util = require "util.file"
    local buf = event.buf
    if file_util.is_big(buf) then
      file_util.disable_futures_for_bigfile(buf)
    end
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
