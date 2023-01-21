return {
  'L3MON4D3/LuaSnip',
  lazy = true,
  config = function()
    local luasnip = require 'luasnip'
    local types = require 'luasnip.util.types'
    require 'luasnip.loaders.from_lua'.lazy_load({ paths = '~/.config/nvim/snippets/' })
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
  end
}
