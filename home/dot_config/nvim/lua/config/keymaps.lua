local map = function(mode, lhs, rhs, desc)
  local opts = { silent = true }
  if desc then
    opts.desc = desc
  end
  vim.keymap.set(mode, lhs, rhs, opts)
end

map("n", "<leader>w", "<cmd>w<cr><esc>", "Write")

-- disable terminal switching
vim.keymap.del("t", "<C-h>")
vim.keymap.del("t", "<C-j>")
vim.keymap.del("t", "<C-k>")
vim.keymap.del("t", "<C-l>")
