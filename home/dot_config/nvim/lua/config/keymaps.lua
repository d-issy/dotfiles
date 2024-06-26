local map = require "util.keymap"

local lazygit = require "util.lazygit"
local buffer = require "util.buffer"

-- stylua: ignore start
map.set("<leader>w", "<cmd>w<cr>", "Write")
map.set("<leader>qq", "<cmd>qa<cr>", "Quit and Save All")
map.set("<leader>md", "<cmd>delmarks! | delmarks A-Z0-9<cr>", "Delete All Marks")
map.set("<leader>bd", function() buffer.remove() end, "Buffer Remove")
map.set("<esc>", "<cmd>noh<cr><esc>", "esc", { mods = { "i", "n" } })

map.set("<leader>gg", function() lazygit.open() end, "Lazygit")
map.set("<leader>gf", function() lazygit.file_history() end, "Current File History")
map.set("<leader>gl", function() lazygit.commit_log() end, "Commit Log")
