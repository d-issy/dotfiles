local function python_formatter(buf)
  if require("conform").get_formatter_info("ruff_format", buf).available then
    return { "ruff_format" }
  end
  return { "black", "isort" }
end

local function js_ts_formatter(buf)
  local fname = vim.api.nvim_buf_get_name(buf)
  local dir = fname ~= "" and vim.fs.dirname(fname) or vim.uv.cwd()

  -- oxfmt
  local oxfmt = vim.fs.find({ ".oxfmtrc.json", ".oxfmtrc.jsonc" }, { upward = true, path = dir })
  if #oxfmt > 0 then
    return { "oxfmt" }
  end

  -- biome
  local biome = vim.fs.find({ "biome.json", "biome.jsonc" }, { upward = true, path = dir })
  if #biome > 0 then
    return { "biome" }
  end

  -- prettier
  return { "prettierd", "prettier", stop_after_first = true }
end

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
    formatters = {
      oxfmt = {
        command = "oxfmt",
        args = { "--stdin-filepath", "$FILENAME" },
        stdin = true,
      },
    },
    formatters_by_ft = {
      ["python"] = python_formatter,

      ["go"] = { "goimports", "gofumpt" },
      ["json"] = { "jq" },
      ["lua"] = { "stylua" },
      ["rust"] = { "rustfmt" },
      ["sh"] = { "shfmt" },
      ["proto"] = { "buf" },

      ["javascript"] = js_ts_formatter,
      ["javascriptreact"] = js_ts_formatter,
      ["typescript"] = js_ts_formatter,
      ["typescriptreact"] = js_ts_formatter,
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
