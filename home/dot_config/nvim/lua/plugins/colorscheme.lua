return {
  -- tokyonight
  {
    'folke/tokyonight.nvim',
    priority = 1000,
    opts = { style = 'moon' },
  },

  -- edge
  {
    'sainnhe/edge',
    priority = 1000,
    config = function()
      vim.g.edge_style = 'neon'
      vim.g.edge_dim_foreground = 1
    end,
  },

  -- catppuccin
  -- @cspell: words catppuccin
  {
    'catppuccin/nvim',
    lazy = true,
    name = 'catppuccin',
  },
}
