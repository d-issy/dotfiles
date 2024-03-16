return {
  {
    "ThePrimeagen/refactoring.nvim",
    cmd = { "Refactor" },
    keys = {
      {
        "<leader>cr",
        function() require("refactoring").select_refactor { show_success_message = true } end,
        mode = "v",
        desc = "Refactor",
      },
    },
    opts = {
      prompt_func_param_type = {
        javascript = true,
        python = true,
        typescript = true,
      },
      prompt_func_return_type = {
        javascript = true,
        python = true,
        typescript = true,
      },
    },
  },
}
