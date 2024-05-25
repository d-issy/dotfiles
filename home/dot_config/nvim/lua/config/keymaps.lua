local keymap = require "util.keymap"

keymap.set("<leader>w", "<cmd>w<cr><esc>", "Write")

local lazygit = function() require("util.lazygit").open { cwd = require("lazyvim.util").root.git() } end
keymap.set("<leader>gg", lazygit, "Lazygit (Root Dir)")
keymap.set("<leader>gG", function() require("util.lazygit").open() end, "Lazygit (cwd)")
keymap.set("<leader>gf", function() require("util.lazygit").file_history() end, "Current File History")

local term = function() require("util.terminal").open(nil, { cwd = require("lazyvim.util").root() }) end
keymap.set("<leader>ft", term, "Terminal (Root Dir)")
keymap.set("<leader>fT", function() require("util.terminal").open() end, "Terminal (cwd)")

-- disable terminal switching
keymap.delete("<C-h>", "t")
keymap.delete("<C-j>", "t")
keymap.delete("<C-k>", "t")
keymap.delete("<C-l>", "t")
