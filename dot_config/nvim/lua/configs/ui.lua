-- indent line
require 'indent_blankline'.setup {
  char = "¦",
}

-- bufferline
local groups = require('bufferline.groups')
require 'bufferline'.setup {
  options = {
    mode = 'buffers',
    groups = {
      options = {
        toggle_hhidden_on_enter = true
      },
      items = {
        groups.builtin.ungrouped,
        {
          name = 'docs',
          matcher = function(buf) return buf.name:match('%.md') end
        },
        {
          name = 'tests',
          matcher = function(buf)
            return buf.name:match('^.+_test%..+$')
                or buf.name:match('^test_.+$')
                or buf.name:match('%.spec%.')
          end
        },
      }
    },
  }
}


-- treesitter
require 'nvim-treesitter.configs'.setup {
  ensure_installed = 'all',
  sync_install = false,
  auto_install = false,
  ignore_install = {},
  highlight = {
    enable = true,
    disable = {},
    additional_vim_regex_highlighting = true,
  },
  rainbow = {
    enable = true,
    disabe = {},
    extended_mode = true,
    max_file_lines = nil,
  },
  playground = {
    enable = true,
    disable = {},
    updatetime = 25,
    persist_queries = false,
    keybindings = {
      toggle_query_editor = 'o',
      toggle_hl_groups = 'i',
      toggle_injected_languages = 't',
      toggle_anonymous_nodes = 'a',
      toggle_language_display = 'I',
      focus_language = 'f',
      unfocus_language = 'F',
      update = 'R',
      goto_node = '<cr>',
      show_help = '?',
    },
  }
}

-- colorscheme settings
vim.g.edge_style = 'neon'
vim.g.edge_dim_foreground = 1
vim.cmd 'colorscheme edge'
