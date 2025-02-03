return {
  "MagicDuck/grug-far.nvim",
  cmd = { "GrugFar" },
  opts = {
    windowCreationCommand = "15split",
    openTargetWindow = {
      preferredLocation = "above",
    },
    sratrInsertMode = true,
    keymaps = {
      qflist = { n = "<c-q>" },
      refresh = { n = "<c-r>" },
      close = { n = "q" },
      replace = { n = "<leader>r" },
      syncLocations = { n = "<leader>s" },
      syncLine = { n = "<leader>l" },
      historyOpen = { n = "<leader>t" },
      historyAdd = { n = "<leader>a" },
      gotoLocation = { n = "<enter>" },
      pickHistoryEntry = { n = "<enter>" },
      abort = { n = "<leader>b" },
    },
  },
  keys = {
    { "<leader>fr", "<cmd>GrugFar<cr>", desc = "Find or Replace" },
  },
}
