return {
  {
    "LazyVim/LazyVim",
    lazy = false,
    opts = {
      colorscheme = "default",
      defaults = { autocmds = false, keymaps = false },
      news = { lazyvim = false, neovim = false },
    },
    config = function(_, opts)
      require("lazyvim").setup(opts)
      require "config.options"
    end,
  },
  {
    "nvim-lua/plenary.nvim",
    event = { "UIEnter" },
  },
}
