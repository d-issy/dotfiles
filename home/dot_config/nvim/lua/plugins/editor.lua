return {
  {
    "neo-tree.nvim",
    opts = {
      source_selector = {
        winbar = true,
      },
      window = {
        width = 30,
        mappings = { ["/"] = "none" },
      },
      buffers = {
        window = {
          mappings = {
            ["d"] = "buffer_delete",
          },
        },
      },
    },
  },
  {
    "flash.nvim",
    keys = {
      { "s", mode = { "n", "x", "s" }, false },
      { "S", mode = { "n", "x", "s" }, false },
    },
  },
  {
    "telescope.nvim",
    opts = function(_, opts)
      -- disable trouble
      opts.defaults.mappings.i["<c-t>"] = nil
      opts.defaults.mappings.i["<a-t>"] = nil
    end,
  },
}
