local format = require "util.format"
local conform = require "conform"

vim.opt.formatexpr = "v:lua.require'conform'.formatexpr()"

vim.api.nvim_create_autocmd("BufWritePre", {
  group = vim.api.nvim_create_augroup("conform-format-on-save", { clear = true }),
  pattern = "*",
  callback = function(args)
    if format.enabled(args.buf) then
      conform.format { bufnr = args.buf }
    end
  end,
})
