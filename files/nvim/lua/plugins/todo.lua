return {
  "folke/todo-comments.nvim",
  dependencies = { "fzf-lua" },
  event = { "BufReadPost" },
  opts = {},
  -- stylua: ignore
  keys = {
    { "]t", function() require("todo-comments").jump_next() end, desc = "Next Todo Comment" },
    { "[t", function() require("todo-comments").jump_prev() end, desc = "Previous Todo Comment" },
    { "<leader>ft", function() require("todo-comments.fzf").todo() end, desc = "Todo" },
    { "<leader>fT", function () require("todo-comments.fzf").todo { keywords = {"TODO", "FIX", "FIXME"} } end, desc = "Todo/Fix/Fixme" },
  },
}
