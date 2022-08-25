local luasnip_ok, luasnip = pcall(require, 'luasnip')
if not luasnip_ok then
  return
end

require 'luasnip.loaders.from_lua'.lazy_load({ paths = '~/.config/nvim/snippets/' })

local types = require 'luasnip.util.types'

luasnip.config.set_config {
  updateevents = 'TextChanged,TextChangedI',
  enable_autosnippets = true,
  ext_opts = {
    [types.choiceNode] = {
      active = {
        virt_text = { { "●" } }
      }
    },
    [types.insertNode] = {
      active = {
        virt_text = { { "●" } }
      }
    }
  },
}

vim.api.nvim_create_autocmd('InsertLeave', {
  pattern = '*',
  callback = function()
    if luasnip.session.current_nodes[vim.api.nvim_get_current_buf()] then
      luasnip.unlink_current()
    end
  end
})
