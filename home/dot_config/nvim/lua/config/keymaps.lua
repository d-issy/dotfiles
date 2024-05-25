vim.keymap.set("n", "<leader>w", "<cmd>w<cr><esc>", { silent = true, desc = "Write" })
vim.keymap.set("n", "<leader>gg", function()
  -- tmux session
  if vim.fn.getenv "TMUX" then
    vim.fn.system { "tmux", "popup", "-d", "#{pane_current_path}", "-h", "95%", "-w", "95%", "-E", "lazygit" }
  else
    require("lazyvim.util").terminal.open "lazygit"
  end
end, { silent = true, desc = "LazyGit" })

-- disable terminal switching
vim.keymap.del("t", "<C-h>")
vim.keymap.del("t", "<C-j>")
vim.keymap.del("t", "<C-k>")
vim.keymap.del("t", "<C-l>")
