return {
  { "nvim-lua/plenary.nvim" },
  {
    "akinsho/bufferline.nvim",
    version = "*",
    event = { "BufReadPost" },
    opts = {
      options = {
        diagnostics = "nvim_lsp",
        diagnostics_update_in_insert = true,
        ---@diagnostic disable-next-line: unused-local
        diagnostics_indicator = function(count, level, diagnostics_dict, context)
          local icon = level:match "error" and " " or " "
          return " " .. icon .. count
        end,
        show_buffer_close_icons = false,
        show_close_icon = false,

        custom_filter = require("util.buffer").is_managed,
      },
    },
    keys = {
      { "<leader>bp", "<Cmd>BufferLineTogglePin<CR>", desc = "Toggle Pin" },
      { "<leader>bP", "<Cmd>BufferLineGroupClose ungrouped<CR>", desc = "Delete Non-Pinned Buffers" },
      { "<leader>bo", "<Cmd>BufferLineCloseOthers<CR>", desc = "Delete Other Buffers" },
      { "<leader>bl", "<Cmd>BufferLineCloseRight<CR>", desc = "Delete Buffers to the Right" },
      { "<leader>bh", "<Cmd>BufferLineCloseLeft<CR>", desc = "Delete Buffers to the Left" },
      { "<S-h>", "<cmd>BufferLineCyclePrev<cr>", desc = "Prev Buffer" },
      { "<S-l>", "<cmd>BufferLineCycleNext<cr>", desc = "Next Buffer" },
      { "[b", "<cmd>BufferLineCyclePrev<cr>", desc = "Prev Buffer" },
      { "]b", "<cmd>BufferLineCycleNext<cr>", desc = "Next Buffer" },
      { "[B", "<cmd>BufferLineMovePrev<cr>", desc = "Move buffer prev" },
      { "]B", "<cmd>BufferLineMoveNext<cr>", desc = "Move buffer next" },
    },
    config = function(_, opts)
      require("bufferline").setup(opts)
    end,
  },
  {
    "Bekaboo/dropbar.nvim",
    event = { "BufReadPost" },
    config = true,
  },
  {
    "folke/flash.nvim",
    event = "VeryLazy",
    opts = {},
    --stylua: ignore
    keys = {
      { "gl", mode = { "n", "o", "x" }, function() require("flash").jump() end, desc = "Flash" },
      { "gL", mode = { "n", "o", "x" }, function() require("flash").treesitter() end, desc = "Flash Treesitter" },
    },
  },
  {
    "stevearc/dressing.nvim",
    opts = {},
    init = function()
      ---@diagnostic disable-next-line: duplicate-set-field
      vim.ui.select = function(...)
        require("lazy").load { plugins = { "dressing.nvim" } }
        return vim.ui.select(...)
      end
      ---@diagnostic disable-next-line: duplicate-set-field
      vim.ui.input = function(...)
        require("lazy").load { plugins = { "dressing.nvim" } }
        return vim.ui.input(...)
      end
    end,
  },
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      preset = "helix",
      spec = {
        {
          mode = { "n", "v" },
          { "g", group = "goto" },
          { "gs", group = "surround" },
          { "z", group = "fold" },
          { "]", group = "next" },
          { "[", group = "prev" },
          { "<leader><tab>", group = "terminal" },
          { "<leader>a", group = "ai" },
          { "<leader>b", group = "buffer" },
          { "<leader>c", group = "code" },
          { "<leader>f", group = "find" },
          { "<leader>g", group = "git" },
          { "<leader>gh", group = "hunks" },
          { "<leader>q", group = "quit/session" },
          { "<leader>t", group = "test" },
          { "<leader>u", group = "ui" },
        },
      },
      icons = {
        rules = {
          { pattern = "ai", icon = "󰭆", color = "grey" },
          { pattern = "blame", cat = "filetype", name = "git" },
          { pattern = "commit", cat = "filetype", name = "git" },
          { pattern = "delete", icon = "󰆴", color = "red" },
          { pattern = "hunk", cat = "filetype", name = "git" },
          { plugin = "CopilotChat.nvim", icon = "", color = "grey" },
          { plugin = "gitsigns.nvim", cat = "filetype", name = "git" },
          { plugin = "grug-far.nvim", icon = "󰛔 ", color = "blue" },
          { plugin = "mini.files", cat = "filetype", name = "netrw" },
        },
      },
      win = {
        border = require("util.border").generate "WhichKeyBorder",
      },
    },
  },
  { "MunifTanjim/nui.nvim" },
}
