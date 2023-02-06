return {
  -- file explorer
  {
    "nvim-neo-tree/neo-tree.nvim",
    cmd = "Neotree", branch='v2.x',
    keys = {
      {
        "<leader>e",
        function()
          require("neo-tree.command").execute({ toggle = true })
        end,
        desc = "Explorer NeoTree (root dir)"
      }
    },
    init = function()
      vim.g.neo_tree_remove_legacy_commands = 1
      if vim.fn.argc() == 1 then
        local stat = vim.loop.fs_stat(vim.fn.argv(0))
        if stat and stat.type == "directory" then
          require("neo-tree")
        end
      end
    end,
    opts = {
      filesystem = {
        bind_to_cwd = false,
        follow_current_file = true,
      },
      window = {
        mappings = {
          ["<space>"] = "none",
        },
      },
    },
  },

  -- telescope
  {
    'nvim-telescope/telescope.nvim',
    cmd = 'Telescope',
    keys = {
      { '<leader>,', '<cmd>Telescope buffers show_all_buffers=true<cr>', desc='Switch Buffers' },
      { '<leader>/', '<cmd>Telescope live_grep<cr>', desc='Grep' },
      { '<leader>p', '<cmd>Telescope find_files enable_preview=false<cr>', desc='Find Files' },
      { '<leader>gs', '<cmd>Telescope git_status<cr>', desc='Git status' },
      { '<leader>gb', '<cmd>Telescope git_branches<cr>', desc='Switch Branch' },
      { '<leader>sc', '<cmd>Telescope colorscheme enable_preview=true<cr>', desc='Find Files' },
    }
  },

  -- easily jump to any location and enhanced f/t motions for Leap
  {
    "ggandor/leap.nvim",
    event = "VeryLazy",
    dependencies = { { "ggandor/flit.nvim", opts = { labeled_modes = "nv" } } },
    config = function(_, opts)
      local leap = require("leap")
      for k, v in pairs(opts) do
        leap.opts[k] = v
      end
      leap.add_default_mappings(true)
    end
  },

}
