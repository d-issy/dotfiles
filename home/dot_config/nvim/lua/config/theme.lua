-- komau color pallet
local c = {
  black = "#222222",
  medium_gray = "#767676",
  white = "#F5EEE6",
  light_black = "#424242",
  lighter_black = "#545454",
  subtle_black = "#303030",
  light_gray = "#999999",
  lighter_gray = "#CCCCCC",
  lightest_gray = "#E5E5E5",
  yellow = "#FED442",
  pink = "#D73A49",
  green = "#22863A",
  red = "#B31D28",
  orange = "#E36209",
  blue = "#005CC5",
}

local hl = {
  Normal = { fg = c.white, bg = c.black },
  Cursor = { fg = c.lighter_gray, bg = c.lighter_black },
  Comment = { fg = c.lighter_black },

  Constant = { fg = c.medium_gray },
  Character = { fg = c.medium_gray },
  Number = { fg = c.medium_gray },
  Boolean = { fg = c.medium_gray },
  Float = { fg = c.medium_gray },
  String = { fg = c.medium_gray },

  Identifier = { fg = c.white },
  Function = { fg = c.white },

  Statement = { fg = c.pink },
  Conditional = { fg = c.pink },
  Repeat = { fg = c.pink },
  Label = { fg = c.pink },
  Keyword = { fg = c.pink },
  Exception = { fg = c.pink },

  Operator = { fg = c.light_gray },

  PreProc = { fg = c.medium_gray },
  Include = { fg = c.medium_gray },
  Define = { fg = c.medium_gray },
  Macro = { fg = c.medium_gray },
  Precondit = { fg = c.medium_gray },

  Type = { fg = c.white },
  StorageClass = { fg = c.white },
  Structure = { fg = c.white },
  Typedef = { fg = c.white },

  Special = { fg = c.medium_gray },
  SpecialChar = { fg = c.medium_gray },
  Tag = { fg = c.medium_gray },
  Delimiter = { fg = c.medium_gray },
  SpecialComment = { fg = c.medium_gray },
  Debug = { fg = c.medium_gray },

  WinBar = { fg = c.white, bg = c.black },
}

-- colorschme load
vim.cmd "hi clear"
for group, opts in pairs(hl) do
  vim.api.nvim_set_hl(0, group, opts)
end
