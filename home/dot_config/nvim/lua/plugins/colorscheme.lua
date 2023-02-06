return{

  -- tokyonight
  {
    "folke/tokyonight.nvim",
    lazy = true,
    opts = { style = "moon" },
  },

  -- edge
  {
    'sainnhe/edge',
    lazy = true,
    priority = 1000,
    config = function()
      vim.g.edge_style = 'neon'
      vim.g.edge_dim_foreground = 1
    end,
  },

  -- catppuccin
  {
    "catppuccin/nvim",
    lazy = true,
    name = "catppuccin",
  },
}
