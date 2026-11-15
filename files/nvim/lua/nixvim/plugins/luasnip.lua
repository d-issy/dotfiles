local luasnip = require "luasnip"

for _, ft in ipairs { "typescriptreact", "javascript", "javascriptreact" } do
  luasnip.filetype_extend(ft, { "typescript" })
end

vim.api.nvim_create_autocmd("InsertLeave", {
  pattern = "*",
  callback = function()
    local luasnip = require "luasnip"
    if luasnip.session.current_nodes[vim.api.nvim_get_current_buf()] then
      luasnip.unlink_current()
    end
  end,
})
