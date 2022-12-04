local status_ok, lualine = pcall(require, 'lualine')
if not status_ok then
  return
end


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

local active = function()
  return ' '
end

local filename = {
  'filename',
  path = 1,
  file_stats = true,
  color = { gui = 'bold' },
  symbols = {
    modified = ' [+]',
    readonly = ' [-]',
    unnamed = '-',
  },
}

lualine.setup {
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
    globalstatus = false,
  },
  tabline = {
    lualine_a = {
      {
        'mode',
        fmt = function(mode) return mode:sub(1, 1) end,
      },
    },
    lualine_b = {},
    lualine_c = {
      { 'tabs', mode = 1 },
    },
    lualine_x = {
      {
        'diff',
        diff_color = {
          added = { fg = colors.green },
          modified = { fg = colors.yellow },
          removed = { fg = colors.red1 },
        },
      },
    },
    lualine_y = { 'branch' },
    lualine_z = {}
  },
  sections = {
    lualine_a = { active },
    lualine_b = {
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
    lualine_c = { filename },
    lualine_x = {
      'filesize',
      { 'filetype', colored = false },
    },
    lualine_y = {},
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
    lualine_c = { filename },
    lualine_x = {
      'filesize',
      { 'filetype', colored = false }
    },
    lualine_y = {},
    lualine_z = {}
  },
  extensions = { 'neo-tree', 'toggleterm' }
}