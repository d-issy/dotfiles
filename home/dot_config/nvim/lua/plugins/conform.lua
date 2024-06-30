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
    format_on_save = {
      timeout_ms = 500,
      lsp_fallback = true,
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
  },
  init = function()
    vim.api.nvim_create_autocmd("BufWritePre", {
      pattern = "*",
      callback = function(args)
        require("conform").format { bufnr = args.buf }
      end,
    })
  end,
}
