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
    "zbirenbaum/copilot-cmp",
    dependencies = { "copilot.lua" },
    opts = {},
    config = function(_, opts)
      require("copilot_cmp").setup(opts)
    end,
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
    },
  },
}
