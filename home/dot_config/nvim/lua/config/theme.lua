local palette = {
  bg = "#272727",
  default = "#acacac",
  low = "#797979",
  search = "#f2f2aa",

  string = "#a6da95",
  error = "#ed8796",
  warning = "#eed49f",
  info = "#7dc4e4",
  hint = "#8aadf4",

  visual = "#ffffff",
  visual_bg = "#383838",
}

local hl = {
  -- reset colors
  Normal = { fg = palette.default, bg = palette.bg },
  WinBar = { fg = palette.default, bg = palette.bg },
  Comment = { fg = palette.low },

  Visual = { fg = palette.visual, bg = palette.visual_bg },

  Identifier = { fg = palette.default },
  Function = { fg = palette.default },
  Constant = { fg = palette.default },
  String = { fg = palette.default },
  Statement = { fg = palette.default },
  Variable = { fg = palette.default },
  PreProc = { fg = palette.default },
  Type = { fg = palette.default },
  Todo = { fg = palette.default },

  Search = { fg = palette.search, bg = palette.bg },
  CurSearch = { fg = palette.search, bg = palette.bg, underline = true },
  ["@variable"] = { fg = palette.default },

  -- set
  Special = { fg = palette.low },
  Operator = { fg = palette.low },
  ["@punctuation.bracket"] = { fg = palette.low },
  ["@punctuation.delimiter"] = { fg = palette.low },

  DiagnosticError = { fg = palette.error },
  DiagnosticWarn = { fg = palette.warning },
  DiagnosticInfo = { fg = palette.info },
  DiagnosticHint = { fg = palette.hint },

  DiagnosticUnnecessary = { fg = palette.hint, underline = true },
  DiagnosticUnderlineError = { fg = palette.error, underline = true },

  -- sql
  ["@type.builtin.sql"] = { fg = palette.default },
}

-- colorschme load
vim.cmd "hi clear"
for group, opts in pairs(hl) do
  vim.api.nvim_set_hl(0, group, opts)
end
