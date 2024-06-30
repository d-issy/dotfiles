local map = require "util.map"

local lazygit = require "util.lazygit"
local buffer = require "util.buffer"

map.setup {
  -- basic
  { "<leader>w", "<cmd>w<cr>", desc = "Write" },
  { "<leader>qq", "<cmd>qa<cr>", mode = { "n", "t" }, desc = "Quit and Save All" },
  { "<leader>md", "<cmd>delmarks! | delmarks A-Z0-9<cr>", desc = "Delete All Marks" },
  { "<leader>bd", buffer.remove, desc = "Buffer Remove" },
  { "<esc>", "<cmd>noh<cr><esc>", desc = "esc", mode = { "i", "n" } },

  -- terminal
  { "<leader><tab><tab>", "10<c-w>s<cmd>terminal<cr>", desc = "Terminal" },
  { "<leader><tab>v", "<c-w>v<cmd>terminal<cr>", desc = "Terminal" },
  { "<leader><esc>", "<c-\\><c-n>", mode = "t", desc = "ESC" },
  { "<c-w>h", "<c-\\><c-n><c-w>h", mode = "t", desc = "Left" },
  { "<c-w>j", "<c-\\><c-n><c-w>j", mode = "t", desc = "Down" },
  { "<c-w>k", "<c-\\><c-n><c-w>k", mode = "t", desc = "Up" },
  { "<c-w>l", "<c-\\><c-n><c-w>l", mode = "t", desc = "Right" },

  -- lazygit
  { "<leader>gg", lazygit.open, desc = "Lazygit" },
  { "<leader>gf", lazygit.file_history, desc = "Current File History" },
  { "<leader>gl", lazygit.commit_log, desc = "Commit Log" },
}
