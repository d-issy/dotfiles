return {
  { "nvim-lua/plenary.nvim" },
  {
    "akinsho/bufferline.nvim",
    version = "*",
    event = { "BufReadPost" },
    opts = {
      options = {
        diagnostics = "nvim_lsp",
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
    "folke/noice.nvim",
    event = "VeryLazy",
    opts = {
      cmdline = { view = "cmdline" },
      lsp = {
        hover = { enabled = false },
        message = { enabled = false },
        progress = { enabled = false },
        signature = { enabled = false },
      },
    },
  },
  {
    "folke/flash.nvim",
    event = "VeryLazy",
    opts = {},
    --stylua: ignore
    keys = {
      { "<leader>j", mode = { "n", "o", "x" }, function() require("flash").jump() end, desc = "Flash" },
      { "<leader>J", mode = { "n", "o", "x" }, function() require("flash").treesitter() end, desc = "Flash Treesitter" },
    },
  },
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts_extend = { "spec" },
    opts = {
      preset = "helix",
      triggers = {
        { "<auto>", mode = "nv" },
      },
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
      win = { border = "rounded" },
    },
    keys = {
      {
        "<leader>?",
        function()
          require("which-key").show { global = false }
        end,
        desc = "Buffer Keymaps (which-key)",
      },
    },
  },
  { "MunifTanjim/nui.nvim" },
}
