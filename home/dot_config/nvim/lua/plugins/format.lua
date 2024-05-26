return {
  "conform.nvim",
  opts = {
    formatters_by_ft = {
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
}
