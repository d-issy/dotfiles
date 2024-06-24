local map = require "util.keymap"

local lazygit = function()
  require("util.lazygit").open { cwd = require("lazyvim.util").root.git() }
end

-- stylua: ignore start
map.set("<leader>w", "<cmd>w<cr>", "Write")
map.set("<leader>qq", "<cmd>qa<cr>", "Quit and Save All")
map.set("<leader>md", "<cmd>delmarks! | delmarks A-Z0-9<cr>", "Delete All Marks")
map.set("<esc>", "<cmd>noh<cr><esc>", "esc", { mods = { "i", "n" } })

map.set("<leader>gg", lazygit, "Lazygit (Root Dir)")
map.set("<leader>gG", function() require("util.lazygit").open() end, "Lazygit (cwd)")
map.set("<leader>gf", function() require("util.lazygit").file_history() end, "Current File History")
map.set("<leader>gl", function() require("util.lazygit").commit_log() end, "Commit Log")
-- stylua: ignore end
