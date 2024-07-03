return {
  "stevearc/conform.nvim",
  dependencies = { "mason.nvim" },
  event = { "BufReadPost" },
  opts = {
    formatters_by_ft = {
      ["lua"] = { "stylua" },
      ["python"] = { "black", "isort" },
      ["go"] = { "goimports", "gofumpt" },

      ["javascript"] = { { "prettierd", "prettier" } },
      ["javascriptreact"] = { { "prettierd", "prettier" } },
      ["typescript"] = { { "prettierd", "prettier" } },
      ["typescriptreact"] = { { "prettierd", "prettier" } },
      ["markdown"] = { { "prettierd", "prettier" }, "markdownlint", "markdown-doc" },
      ["markdown.mdx"] = { { "prettierd", "prettier" }, "markdownlint", "markdown-doc" },

      ["terraform"] = { "terraform_fmt" },
      ["terraform-vars"] = { "terraform_fmt" },
      ["tf"] = { "terraform_fmt" },
    },
  },
  keys = {
    {
      "<leader>cf",
      function()
        require("conform").format { async = true, lsp_fallback = true }
      end,
      desc = "Format Buffer",
    },
    {
      "<leader>uf",
      function()
        require("util.format").toggle(true)
      end,
      desc = "Toggle Buffer AutoFormat",
    },
    {
      "<leader>uF",
      require("util.format").toggle,
      { desc = "Toggle Global AutoFormat" },
    },
  },
  init = function()
    local format = require "util.format"
    local conform = require "conform"

    vim.opt.formatexpr = "v:lua.require'conform'.formatexpr()"

    vim.api.nvim_create_autocmd("BufWritePre", {
      pattern = "*",
      callback = function(args)
        if format.enabled() then
          conform.format {
            bufnr = args.buf,
            lsp_fallback = true,
            timeout_ms = 500,
          }
        end
      end,
    })
  end,
}
