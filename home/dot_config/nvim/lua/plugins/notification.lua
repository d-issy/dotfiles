return {
  {
    "rcarriga/nvim-notify",
    opts = {
      stages = "static",
      timeout = 3000,
    },
  },
  {
    "folke/noice.nvim",
    event = "VeryLazy",
    dependencies = { "nvim-notify", "fzf-lua" },
    opts = {
      cmdline = { view = "cmdline" },
      routes = {
        {
          filter = {
            event = "msg_show",
            any = {
              -- write
              { find = "%d+L, %d+B" },

              -- histroy
              { find = "; after #%d" },
              { find = "; before #%d" },

              -- search
              { find = "Pattern not found: " },

              -- GitSigns
              { find = "Hunk %d of %d" },
            },
          },
          view = "mini",
        },
        presets = {
          bottom_search = true,
          command_palette = true,
          long_message_to_split = true,
        },
      },
      lsp = {
        hover = { enabled = false },
        signature = { enabled = false },
      },
    },
    keys = {
      { "<leader>fn", "<cmd>NoiceFzf<cr>", desc = "Noice Mesasges" },
    },
  },
}
