return {
  "conform.nvim",
  opts = {
    formatters_by_ft = {
      ["python"] = { "black", "isort" },
      ["javascript"] = { "prettier" },
      ["javascriptreact"] = { "prettier" },
      ["typescript"] = { "prettier" },
      ["typescriptreact"] = { "prettier" },
      ["terraform"] = { "terraform_fmt" },
      ["terraform-vars"] = { "terraform_fmt" },
      ["tf"] = { "terraform_fmt" },
    },
  },
}
