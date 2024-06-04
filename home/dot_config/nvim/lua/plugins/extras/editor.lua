return {
  {
    "Bekaboo/dropbar.nvim",
    event = { "LazyFile" },
    config = true,
  },
  {
    "MagicDuck/grug-far.nvim",
    config = true,
    cmd = { "GrugFar" },
    keys = {
      { "<leader>sr", "<cmd>GrugFar<cr>", "Find or Replace Text" },
    },
  },
}
