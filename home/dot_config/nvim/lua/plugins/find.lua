return {
  "MagicDuck/grug-far.nvim",
  cmd = { "GrugFar" },
  opts = {
    windowCreationCommand = "split",
    sratrInsertMode = false,
    window = { height = 10 },
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
    { "<leader>fr", "<cmd>GrugFar<cr><cmd>resize 15<cr>I", "find/replace Text" },
  },
}
