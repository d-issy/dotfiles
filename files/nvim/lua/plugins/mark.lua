return {
  "2kabhishek/markit.nvim",
  dependencies = { "2kabhishek/pickme.nvim" },
  event = { "BufReadPre", "BufNewFile" },
  opts = {
    default_mappings = true,
    signs = true,
  },
}
