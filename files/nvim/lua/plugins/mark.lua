return {
  "kabhishek/markit.nvim",
  event = { "BufReadPre", "BufNewFile" },
  opts = {
    default_mappings = true,
    signs = true,
  },
  config = function(_, opts)
    require("marks").setup(opts)
  end,
}
