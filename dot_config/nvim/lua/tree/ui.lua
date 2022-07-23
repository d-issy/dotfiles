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

-- lualine
local colors = {
  blue   = '#61afef',
  green  = '#98c379',
  purple = '#c678dd',
  cyan   = '#56b6c2',
  red1   = '#e06c75',
  red2   = '#be5046',
  yellow = '#e5c07b',
  fg     = '#abb2bf',
  bg     = '#282c34',
  gray1  = '#828997',
  gray2  = '#2c323c',
  gray3  = '#3e4452',
}

require 'lualine'.setup {
  options = {
    icons_enabled = true,
    theme = {
      normal = {
        a = { fg = colors.bg, bg = colors.green, gui = 'bold' },
        b = { fg = colors.fg, bg = colors.gray3 },
        c = { fg = colors.fg, bg = colors.gray2 },
      },
      insert = { a = { fg = colors.bg, bg = colors.blue, gui = 'bold' } },
      visual = { a = { fg = colors.bg, bg = colors.purple, gui = 'bold' } },
      replace = { a = { fg = colors.bg, bg = colors.red1, gui = 'bold' } },
      terminal = { a = { fg = colors.bg, bg = colors.cyan, gui = 'bold' } },
      command = { a = { fg = colors.bg, bg = colors.yellow, gui = 'bold' } },
      inactive = {
        a = { fg = colors.gray1, bg = colors.bg, gui = 'bold' },
        b = { fg = colors.gray1, bg = colors.bg },
        c = { fg = colors.gray1, bg = colors.gray2 },
      },
    },
    component_separators = { left = '', right = '' },
    section_separators = { left = '', right = '' },
    disabled_filetypes = {},
    always_divide_middle = true,
    globalstatus = true,
  },
  sections = {
    lualine_a = {
      {
        'mode',
        fmt = function(mode) return mode:sub(1, 1) end,
      }
    },
    lualine_b = {
      'branch',
      {
        'diff',
        diff_color = {
          added = { fg = colors.green },
          modified = { fg = colors.yellow },
          removed = { fg = colors.red1 },
        },
        symbols = {
          added = ' ',
          modified = ' ',
          removed = ' ',
        }
      },
      {
        'diagnostics',
        diagnostics_color = {
          error = { fg = colors.red1, gui = 'bold' },
          warn = { fg = colors.red2, gui = 'bold' },
          info = { fg = colors.green, gui = 'bold' },
          hint = { fg = colors.yellow, gui = 'bold' },
        }
      }
    },
    lualine_c = { '' },
    lualine_x = {
      {
        'filename',
        path = 1,
        file_stats = true,
        color = { gui = 'bold' },
        symbols = {
          modified = ' [+]',
          readonly = ' [-]',
          unnamed = '-',
        },
      },
      'filesize',
    },
    lualine_y = {
      'encoding',
      {
        'fileformat',
        symbols = {
          unix = 'unix',
          dos = 'dos',
          mac = 'mac',
        }
      },
      {
        'filetype',
        colored = false,
      },
    },
    lualine_z = {},
    -- defaults:
    --   lualine_a = { 'mode' },
    --   lualine_b = { 'branch', 'diff', 'diagnostics' },
    --   lualine_c = { 'filename' },
    --   lualine_x = { 'encoding', 'fileformat', 'filetype' },
    --   lualine_y = { 'progress' },
    --   lualine_z = { 'location' }
  },
  inactive_sections = {
    lualine_a = {},
    lualine_b = {},
    lualine_c = { 'filename' },
    lualine_x = { 'location' },
    lualine_y = {},
    lualine_z = {}
  },
  tabline = {},
  extensions = { 'neo-tree', 'toggleterm' }
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
