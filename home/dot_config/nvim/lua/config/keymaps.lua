local keymap = require "util.keymap"

keymap.set("<leader>w", "<cmd>w<cr>", "Write")
keymap.set("<leader>qq", "<cmd>qa<cr>", "Quit and Save All")
keymap.set("<leader>md", "<cmd>delmarks! | delmarks A-Z0-9<cr>", "Delete All Marks")
keymap.set("<esc>", "<cmd>noh<cr><esc>", "esc", { mods = { "i", "n" } })

local lazygit = function()
  require("util.lazygit").open { cwd = require("lazyvim.util").root.git() }
end
keymap.set("<leader>gg", lazygit, "Lazygit (Root Dir)")
keymap.set("<leader>gG", function()
  require("util.lazygit").open()
end, "Lazygit (cwd)")
keymap.set("<leader>gf", function()
  require("util.lazygit").file_history()
end, "Current File History")
keymap.set("<leader>gl", function()
  require("util.lazygit").commit_log()
end, "Commit Log")
