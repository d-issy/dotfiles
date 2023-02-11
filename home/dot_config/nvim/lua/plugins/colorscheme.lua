return {
  {
    "folke/tokyonight.nvim",
    event = "VeryLazy",
    opts = { style = "moon" },
  },

  {
    "marko-cerovac/material.nvim",
    opts = function()
      vim.g.material_style = "darker"
      return {
        contrast = {
          terminal = true,
          floating_window = true,
        },
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
    event = "VeryLazy",
    config = function()
      vim.g.edge_style = "neon"
      vim.g.edge_dim_foreground = 1
    end,
  },

  -- @cspell: words catppuccin
  {
    "catppuccin/nvim",
    event = "VeryLazy",
    name = "catppuccin",
  },
}
