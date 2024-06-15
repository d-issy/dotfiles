local keymap = require "util.keymap"

keymap.set("<leader>w", "<cmd>w<cr><esc>", "Write")
keymap.set("<leader>md", "<cmd>delmarks! | delmarks A-Z0-9<cr>", "Delete All Marks")

-- local lazygit = function() require("util.lazygit").open { cwd = require("lazyvim.util").root.git() } end
-- keymap.set("<leader>gg", lazygit, "Lazygit (Root Dir)")
-- keymap.set("<leader>gG", function() require("util.lazygit").open() end, "Lazygit (cwd)")
-- keymap.set("<leader>gf", function() require("util.lazygit").file_history() end, "Current File History")
-- keymap.set("<leader>gl", function() require("util.lazygit").commit_log() end, "Commit Log")

-- local term = function() require("util.terminal").open(nil, { cwd = require("lazyvim.util").root() }) end
-- keymap.set("<leader>ft", term, "Terminal (Root Dir)")
-- keymap.set("<leader>fT", function() require("util.terminal").open() end, "Terminal (cwd)")

-- -- disable terminal switching
-- keymap.delete("<C-h>", "t")
-- keymap.delete("<C-j>", "t")
-- keymap.delete("<C-k>", "t")
-- keymap.delete("<C-l>", "t")
