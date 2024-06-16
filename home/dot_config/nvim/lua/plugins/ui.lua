return {
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
    event = {
      "InsertCharPre",
      "TextChangedI",
      "CmdlineEnter",
      "CmdlineLeave",
      "BufReadPre",
    },
    opts = {
      cmdline = { view = "cmdline" },
      messages = { view = "mini" },
      routes = {
        {
          filter = { event = "msg_show", find = "Treesitter" },
          view = "popup",
        },
      },
    },
  },
  { "nvim-tree/nvim-web-devicons" },
  { "MunifTanjim/nui.nvim" },
  { "rcarriga/nvim-notify" },
}
