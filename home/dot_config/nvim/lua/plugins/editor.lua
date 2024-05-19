return {
  {
    "neo-tree.nvim",
    opts = {
      source_selector = {
        winbar = true,
      },
      window = {
        width = 25,
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
      opts.defaults.mappings.i["<c-t>"] = false
      opts.defaults.mappings.i["<a-t>"] = false
    end,
  },
  {
    "mini.files",
    opts = {
      options = { use_as_default_expand = true },
    },
  },
}
