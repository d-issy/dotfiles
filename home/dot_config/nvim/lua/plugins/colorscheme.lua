return {
  {
    "folke/tokyonight.nvim",
    priority = 1000,
    opts = { style = "moon" },
  },

  {
    "marko-cerovac/material.nvim",
    opts = function()
      vim.g.material_style = "darker"
      return {
        plugins = {
          "gitsigns",
          "indent-blankline",
          "lspsaga",
          "nvim-cmp",
          "nvim-navic",
          "nvim-tree",
          "nvim-web-devicons",
          "telescope",
          "trouble",
          "which-key",
        },
        high_visibility = {
          darker = true,
        },
        lualine_style = "stealth",
      }
    end,
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
