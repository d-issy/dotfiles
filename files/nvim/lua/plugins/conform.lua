return {
  "stevearc/conform.nvim",
  dependencies = { "mason.nvim" },
  event = { "BufWritePre" },
  cmd = { "ConformInfo" },
  opts = {
    default_format_opts = {
      timeout_ms = 3000,
      async = false,
      quiet = false,
      lsp_format = "fallback",
    },
    formatters_by_ft = {
      ["python"] = function(buf)
        if require("conform").get_formatter_info("ruff_format", buf).available then
          return { "ruff_format" }
        else
          return { "black", "isort" }
        end
      end,

      ["go"] = { "goimports", "gofumpt" },
      ["json"] = { "jq" },
      ["lua"] = { "stylua" },
      ["rust"] = { "rustfmt" },
      ["sh"] = { "shfmt" },
      ["proto"] = { "buf" },

      ["javascript"] = { "prettierd", "prettier", stop_after_first = true },
      ["javascriptreact"] = { "prettierd", "prettier", stop_after_first = true },
      ["typescript"] = { "prettierd", "prettier", stop_after_first = true },
      ["typescriptreact"] = { "prettierd", "prettier", stop_after_first = true },
      ["markdown"] = { "prettierd", "prettier", stop_after_first = true },
      ["markdown.mdx"] = { "prettierd", "prettier", stop_after_first = true },

      ["terraform"] = { "terraform_fmt" },
      ["terraform-vars"] = { "terraform_fmt" },
      ["tf"] = { "terraform_fmt" },
    },
  },
  keys = {
    {
      "<leader>cf",
      function()
        require("conform").format { async = true }
      end,
      mode = { "n", "v" },
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
      desc = "Toggle Global AutoFormat",
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
          conform.format { bufnr = args.buf }
        end
      end,
    })
  end,
}
