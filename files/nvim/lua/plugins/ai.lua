
return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    build = ":Copilot auth",
    opts = {
      suggestion = { enabled = false },
      panel = { enabled = false },
      filetypes = {
        markdown = true,
        help = true,
      },
    },
  },
  {
    "yetone/avante.nvim",
    event = "VeryLazy",
    enabled = function()
      return vim.env.XDG_CONFIG_HOME == vim.fn.expand "~/.config"
    end,
    lazy = false,
    version = false,
    build = "make",
    dependencies = {
      "zbirenbaum/copilot.lua",
    },
    opts = {
      provider = "copilot",
      file_selector = {
        provider = "snacks",
      },
      windows = {
        sidebar_header = {
          enabled = true,
          align = "right",
          rounded = false,
        },
        input = {
          prefix = "",
        },
      },
    },
  },
}
