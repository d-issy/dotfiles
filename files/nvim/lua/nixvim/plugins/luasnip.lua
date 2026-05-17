vim.api.nvim_create_autocmd("InsertLeave", {
  pattern = "*",
  callback = function()
    require("util.copilot").on()
    local luasnip = require "luasnip"
    if luasnip.session.current_nodes[vim.api.nvim_get_current_buf()] then
      luasnip.unlink_current()
    end
  end,
})
