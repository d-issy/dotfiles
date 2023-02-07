return {
  -- cmp
  {
    'hrsh7th/nvim-cmp',
    dependencies = {
      'hrsh7th/cmp-nvim-lsp',
      'hrsh7th/cmp-path',
      'hrsh7th/cmp-buffer',
      'saadparwaiz1/cmp_luasnip',
    },
    config = function()
      local cmp = require 'cmp'
      local types = require 'cmp.types'
      cmp.setup {
        completion={
          autocmplete={ types.cmp.TriggerEvent.TextChanged },
          completeopt='menu,menuone,noselect'
        },
        snippet = {
          expand=function(args) require('luasnip').lsp_expand(args.body) end
        },
        sources = cmp.config.sources{
          {name='nvim_lsp'},
          {name='luasnip'},
          {name='path'},
          {name='buffer'},
        },
        mapping = cmp.mapping.preset.insert {
          ['<C-Space>'] = cmp.mapping.complete(),
          ['<CR>'] = cmp.mapping.confirm({select=true})
        }
      }
    end
  },

  -- snippet
  {
    'L3MON4D3/LuaSnip',
    keys = {
      {'<C-k>', function() require('luasnip').expand_or_jump() end, mode={'i','s'}},
      {'<C-l>', function() require('luasnip').jump(-1) end, mode={'i','s'}},
    },
    config = function()
      local luasnip = require('luasnip')
      luasnip.setup{}
      require 'luasnip.loaders.from_lua' .lazy_load({ paths = '~/.config/nvim/snippets/' })
      vim.api.nvim_create_autocmd('InsertLeave', { pattern='*', callback=function()
        if luasnip.session.current_nodes[vim.api.nvim_get_current_buf()] then
          luasnip.unlink_current()
        end
      end})
    end
  },

  --lspsaga
  {
    'glepnir/lspsaga.nvim',
    event={'BufReadPre', 'BufNewFile'},
    config=true,
    keys = {
      {'<leader>ca", "<cmd>Lspsaga code_action<cr>', mode = {'n','v'} },
      {'<leader>cr', '<cmd>Lspsaga rename<cr>'},
      {'gd', '<cmd>Lspsaga lsp_find<cr>'},
      {'K', '<cmd>Lspsaga hover_doc<cr>'},
    }
  },

}
