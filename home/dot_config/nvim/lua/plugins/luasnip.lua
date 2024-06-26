return {
  "L3MON4D3/LuaSnip",
  event = { "InsertEnter" },
  version = "v2.*",
  build = "make install_jsregexp",
  opts = {
    history = true,
    update_events = { "TextChanged", "TextChangedI" },
  },
  config = function(_, opts)
    local luasnip = require "luasnip"
    local from_lua = require "luasnip.loaders.from_lua"

    luasnip.setup(opts)
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
  keys = {
    {
      "<C-k>",
      function()
        require("luasnip").expand_or_jump()
      end,
      mode = { "i", "s" },
    },
    {
      "<C-l>",
      function()
        if require("luasnip").choice_active() then
          require("luasnip").change_choice(1)
        else
          require("luasnip").jump(-1)
        end
      end,
      mode = { "i", "s" },
    },
  },
}
