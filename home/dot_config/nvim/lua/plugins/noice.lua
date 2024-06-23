return {
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
    },
    lsp = {
      hover = { enabled = false },
      signature = { enabled = false },
    },
  },
}
