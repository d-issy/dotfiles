return {
  "nvim-telescope/telescope.nvim",
  cmd = "Telescope",
  branch = "0.1.x",
  opts = {
    defaults = {
      path_display = { "truncate" },
      sorting_strategy = "ascending",
      file_ignore_patterns = {
        ".git",
        ".venv",
        "node_modules",
      },
    },
    pickers = {
      buffers = { theme = "ivy", show_all_buffers = true },
      colorscheme = { enable_preview = true },
      find_files = { theme = "ivy", hidden = true },
      help_tags = { theme = "ivy" },
      live_grep = { theme = "ivy" },
    },
  },
  keys = {
    { "<leader>,", "<cmd>Telescope buffers<cr>", desc = "Buffers" },
    { "<leader>/", "<cmd>Telescope live_grep<cr>", desc = "Grep" },
    { "<leader>f'", "<cmd>Telescope marks<cr>", desc = "Grep" },
    { "<leader>fb", "<cmd>Telescope buffers<cr>", desc = "Buffers" },
    { "<leader>fc", "<cmd>Telescope colorscheme<cr>", desc = "Colorscheme with preview" },
    { "<leader>ff", "<cmd>Telescope find_files<cr>", desc = "Find Files" },
    { "<leader>fh", "<cmd>Telescope help_tags<cr>", desc = "Help Page" },
    { "<leader>fm", "<cmd>Telescope man_pages<cr>", desc = "Help Map Page" },
    { "<leader>fr", "<cmd>Telescope registers<cr>", desc = "Find registers" },
    { "<leader>gb", "<cmd>Telescope git_branches<cr>", desc = "Git branches" },
    { "<leader>gc", "<cmd>Telescope git_commits<cr>", desc = "Git commits" },
  },
}
