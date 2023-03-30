-- cspell: word neotree
return {
  "nvim-neo-tree/neo-tree.nvim",
  cmd = "Neotree",
  branch = "v2.x",
  dependences = {
    "nvim-lua/plenary.nvim",
    "nvim-tree/nvim-web-devicons",
    "MunifTanjim/nui.nvim",
  },
  keys = {
    {
      "<leader>e",
      function() require("neo-tree.command").execute { toggle = true } end,
      desc = "Explorer NeoTree (root dir)",
    },
  },
  init = function()
    vim.g.neo_tree_remove_legacy_commands = 1
    if vim.fn.argc() == 1 then
      local stat = vim.loop.fs_stat(vim.fn.argv(0))
      if stat and stat.type == "directory" then
        require "neo-tree"
      end
    end
  end,
  opts = {
    source_selector = {
      winbar = true,
      statusline = true,
    },
    window = {
      width = 30,
      mappings = {
        ["<space>"] = false,
        ["/"] = false,
        ["?"] = false,
        ["h"] = "show_help",
      },
    },
    filesystem = {
      bind_to_cwd = false,
      follow_current_file = true,
      filtered_items = {
        visible = true,
        never_show = { ".git" },
      },
    },
    buffers = {
      window = {
        mappings = { ["d"] = "buffer_delete" },
      },
    },
    git_status = {
      window = {
        mappings = {
          ["<space>"] = "none",
          ["a"] = "git_add_file",
          ["u"] = "git_unstage_file",
          ["!"] = "git_revert_file",
        },
      },
    },
  },
}
