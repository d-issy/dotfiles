vim.keymap.set("n", "<leader>w", "<cmd>w<cr><esc>", { silent = true, desc = "Write" })

vim.keymap.set(
  "n",
  "<leader>gg",
  function() require("util.lazygit").open() end,
  { silent = true, desc = "Open LazyGit" }
)

vim.keymap.set(
  "n",
  "<leader>ft",
  function() require("util.terminal").open() end,
  { silent = true, desc = "Open Terminal" }
)

-- disable terminal switching
vim.keymap.del("t", "<C-h>")
vim.keymap.del("t", "<C-j>")
vim.keymap.del("t", "<C-k>")
vim.keymap.del("t", "<C-l>")
