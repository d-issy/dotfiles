return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,
  opts = {
    bigfile = { enabled = true },
    gitbrowse = { enabled = true },
    indent = {
      enabled = true,
      indent = { only_current = true },
      chunk = {
        enabled = true,
        char = {
          corner_top = "╭",
          corner_bottom = "╰",
          horizontal = "─",
          vertical = "│",
          arrow = "─",
        },
      },
    },
    input = { enabled = true },
    notifier = {
      enabled = true,
      timeout = 3000,
    },
    quickfile = { enabled = true },
    scope = { enabled = true },
    scroll = {
      enabled = true,
      only_current = true,
      animate = {
        duration = 5,
      },
    },
    words = { enabled = true },
  },
  keys = {
    { "<leader>z", "<cmd>lua require('snacks').zen.zoom()<CR>" },
    { "<leader>gB", "<cmd>lua require('snacks').gitbrowse.open({ what = 'commit' })<CR>", mode = { "n", "v" } },
    { "<leader>cR", "<cmd>lua require('snacks').rename.rename_file()<CR>" },
  },
  init = function()
    local snacks = require "snacks"

    snacks.toggle.option("relativenumber", { name = "Relative Number" }):map "<leader>ur"
    snacks.toggle.option("spell", { name = "Spell" }):map "<leader>us"
    snacks.toggle.option("wrap", { name = "Wrap" }):map "<leader>uw"
    snacks.toggle.diagnostics():map "<leader>ud"
    snacks.toggle.line_number():map "<leader>un"
    snacks.toggle.indent():map "<leader>ug"
  end,
}
