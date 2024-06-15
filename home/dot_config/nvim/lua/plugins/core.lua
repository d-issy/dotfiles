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
    end,
    keys = {
      {
        "<leader>bd",
        function()
          require("lazyvim.util.ui").bufremove()
        end,
        desc = "Buffer Remove",
      },
    },
  },
  {
    "nvim-lua/plenary.nvim",
    event = { "UIEnter" },
  },
  { "nvim-neotest/nvim-nio" },
  { "antoinemadec/FixCursorHold.nvim" },
}
