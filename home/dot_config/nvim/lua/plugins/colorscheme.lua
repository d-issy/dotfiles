return {
  {
    "folke/tokyonight.nvim",
    priority = 1000,
    opts = { style = "moon" },
  },

  {
    "sainnhe/edge",
    priority = 1000,
    config = function()
      vim.g.edge_style = "neon"
      vim.g.edge_dim_foreground = 1
    end,
  },

  -- @cspell: words catppuccin
  {
    "catppuccin/nvim",
    lazy = true,
    name = "catppuccin",
  },
}
