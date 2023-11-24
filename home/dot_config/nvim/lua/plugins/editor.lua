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
}
