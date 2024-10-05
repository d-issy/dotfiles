local map = require "util.map"

local toggle = require "util.toggle"
local buffer = require "util.buffer"

local lazygit = require "util.lazygit"

map.setup {
  -- basic
  { "<leader>w", "<cmd>w<cr>", desc = "File Write" },
  { "<leader>qq", "<cmd>qa<cr>", mode = { "n", "t" }, desc = "Quit and Save All" },
  { "<leader>md", "<cmd>delmarks! | delmarks A-Z0-9<cr>", desc = "Delete All Marks" },
  { "<leader>bd", buffer.delete, desc = "Buffer Delete" },
  { "<esc>", "<cmd>noh<cr><esc>", desc = "esc", mode = { "i", "n" } },
  { "n", "nzz", desc = "Next" },
  { "N", "Nzz", desc = "Previous" },

  -- copy and paste
  { "gy", '"+y', mode = { "n", "x" }, desc = "Copy to system clipboard" },
  { "gp", '"+p', mode = { "n" }, desc = "Paste from system clipboard" },
  { "gp", '"+P', mode = { "x" }, desc = "Paste from system clipboard" },

  -- toggle
  { "<leader>ul", toggle.option { "number", "relativenumber" }, desc = "Toggle number" },
  { "<leader>un", toggle.option "number", desc = "Toggle relativenumber" },
  { "<leader>ur", toggle.option "relativenumber", desc = "Toggle relativenumber" },
  { "<leader>us", toggle.option "spell", desc = "Toggle spell" },
  { "<leader>uw", toggle.option "wrap", desc = "Toggle wrap" },

  -- resize
  { "<c-up>", "<cmd>resize +2<cr>", mode = { "n", "t" }, desc = "Resize Up" },
  { "<c-down>", "<cmd>resize -2<cr>", mode = { "n", "t" }, desc = "Resize Down" },
  { "<c-left>", "<cmd>vertical resize -2<cr>", mode = { "n", "t" }, desc = "Resize Left" },
  { "<c-right>", "<cmd>vertical resize +2<cr>", mode = { "n", "t" }, desc = "Resize Right" },

  -- terminal
  { "<leader><tab><tab>", "10<c-w>s<cmd>terminal<cr>", desc = "Terminal" },
  { "<leader><tab>v", "<c-w>v<cmd>terminal<cr>", mode = "n", desc = "Terminal" },
  { "<leader><tab>v", "<c-\\><c-n><c-w>v<cmd>terminal<cr>", mode = "t", desc = "Terminal" },
  { "<leader><esc>", "<c-\\><c-n>", mode = "t", desc = "ESC" },
  { "<c-w>c", "<c-\\><c-n><c-w>c", mode = "t", desc = "Close" },
  { "<c-w>h", "<c-\\><c-n><c-w>h", mode = "t", desc = "Left" },
  { "<c-w>j", "<c-\\><c-n><c-w>j", mode = "t", desc = "Down" },
  { "<c-w>k", "<c-\\><c-n><c-w>k", mode = "t", desc = "Up" },
  { "<c-w>l", "<c-\\><c-n><c-w>l", mode = "t", desc = "Right" },

  -- lazynvim
  { "<leader>l", "<cmd>Lazy<cr>", desc = "Lazy" },

  -- lazygit
  { "<leader>gg", lazygit.open, desc = "Lazygit" },
  { "<leader>gl", lazygit.commit_log, desc = "Commit Log" },
}
