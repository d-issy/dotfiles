return {
  "neotest",
  dependencies = {
    "nvim-neotest/neotest-go",
    "nvim-neotest/neotest-python",
  },
  opts = {
    adapters = {
      ["neotest-go"] = { recursive_run = true },
      ["neotest-python"] = {},
    },
  },
}
