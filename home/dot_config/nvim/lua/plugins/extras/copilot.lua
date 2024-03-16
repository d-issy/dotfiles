return {
  {
    "zbirenbaum/copilot.lua",
    cmd = "Copilot",
    build = ":Copilot auth",
    opts = true,
  },
  {
    "zbirenbaum/copilot-cmp",
    dependencies = "copilot.lua",
    config = true,
  },
  {
    "nvim-cmp",
    dependencies = "copilot-cmp",
    opts = function(_, opts) table.insert(opts.sources, { name = "copilot" }) end,
  },
}
