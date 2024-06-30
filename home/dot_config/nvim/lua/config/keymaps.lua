local map = require "util.map"

local lazygit = require "util.lazygit"
local buffer = require "util.buffer"

map.setup {
  -- basic
  { "<leader>w", "<cmd>w<cr>", desc = "Write" },
  { "<leader>qq", "<cmd>qa<cr>", desc = "Quit and Save All" },
  { "<leader>md", "<cmd>delmarks! | delmarks A-Z0-9<cr>", desc = "Delete All Marks" },
  { "<leader>bd", buffer.remove, desc = "Buffer Remove" },
  { "<esc>", "<cmd>noh<cr><esc>", desc = "esc", mode = { "i", "n" } },

  -- lazygit
  { "<leader>gg", lazygit.open, desc = "Lazygit" },
  { "<leader>gf", lazygit.file_history, desc = "Current File History" },
  { "<leader>gl", lazygit.commit_log, desc = "Commit Log" },
}
