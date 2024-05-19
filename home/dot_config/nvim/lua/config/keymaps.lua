vim.keymap.set("n", "<leader>w", "<cmd>w<cr><esc>", { silent = true, desc = "Write" })
vim.keymap.set(
  "n",
  "<leader>q",
  function() require("lazyvim.util").terminal.open "lazyvim" end,
  { silent = true, desc = "Open LazyVim" }
)

-- disable terminal switching
vim.keymap.del("t", "<C-h>")
vim.keymap.del("t", "<C-j>")
vim.keymap.del("t", "<C-k>")
vim.keymap.del("t", "<C-l>")
