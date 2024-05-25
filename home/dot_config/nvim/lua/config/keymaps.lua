vim.keymap.set("n", "<leader>w", "<cmd>w<cr><esc>", { silent = true, desc = "Write" })
vim.keymap.set(
  "n",
  "<leader>gg",
  function() require("util.terminal").open "lazygit" end,
  { silent = true, desc = "LazyGit" }
)

-- disable terminal switching
vim.keymap.del("t", "<C-h>")
vim.keymap.del("t", "<C-j>")
vim.keymap.del("t", "<C-k>")
vim.keymap.del("t", "<C-l>")
