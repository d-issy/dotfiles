return {
  "nvim-neotest/neotest",
  dependencies = {
    "nvim-neotest/neotest-go",
    "nvim-neotest/neotest-python",
    -- requirements
    "antoinemadec/FixCursorHold.nvim",
    "nvim-neotest/nvim-nio",
  },
  config = function()
    local neotest_ns = vim.api.nvim_create_namespace "neotest"
    vim.diagnostic.config({
      virtual_text = {
        format = function(diagnostic)
          local message = diagnostic.message:gsub("\n", " "):gsub("\t", " "):gsub("%s+", " "):gsub("^%s+", "")
          return message
        end,
      },
    }, neotest_ns)
    require("neotest").setup {
      adapters = {
        require "neotest-python" {},
        require "neotest-go" { recursive_run = true },
      },
    }
  end,
  keys = {
    -- stylua: ignore start
    { "<leader>tt", function() require("neotest").run.run(vim.fn.expand("%")) end, desc = "Run File" },
    { "<leader>tT", function() require("neotest").run.run(vim.uv.cwd()) end, desc = "Run All Test Files" }, ---@diagnostic disable-line
    { "<leader>tr", function() require("neotest").run.run() end, desc = "Run Nearest" },
    { "<leader>tl", function() require("neotest").run.run_last() end, desc = "Run Last" },
    { "<leader>ts", function() require("neotest").summary.toggle() end, desc = "Toggle Summary" },
    { "<leader>to", function() require("neotest").output.open({ enter = true, auto_close = true }) end, desc = "Show Output" },
    { "<leader>tO", function() require("neotest").output_panel.toggle() end, desc = "Toggle Output Panel" },
    { "<leader>tS", function() require("neotest").run.stop() end, desc = "Stop" },
    { "<leader>tw", function() require("neotest").watch.toggle(vim.fn.expand("%")) end, desc = "Toggle Watch" },
    -- stylua: ignore end
  },
}
