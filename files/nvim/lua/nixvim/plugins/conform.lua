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
