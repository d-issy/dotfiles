return {
  "L3MON4D3/LuaSnip",
  event = { "InsertEnter" },
  version = "v2.*",
  build = "make install_jsregexp",
  config = function()
    local luasnip = require "luasnip"
    local from_lua = require "luasnip.loaders.from_lua"

    luasnip.setup { update_events = "TextChanged,TextChangedI" }
    from_lua.lazy_load { paths = { "~/.config/nvim/lua/snippets/" } }

    vim.api.nvim_create_autocmd("InsertLeave", {
      pattern = "*",
      callback = function()
        if luasnip.session.current_nodes[vim.api.nvim_get_current_buf()] then
          luasnip.unlink_current()
        end
      end,
    })
  end,
}
