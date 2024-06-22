local palette = {
  bg = "#272727",
  default = "#9c9c9c",

  border = "#ffffff",

  ui = "#cfcfcf",
  visual_bg = "#383838",

  low = "#797979",
  search = "#f2f2aa",
  cmp = "#f9f9f9",

  error = "#ed8796",
  warning = "#eed49f",
  info = "#7dc4e4",
  hint = "#8aadf4",

  folder = "#54aeff",
}

local hl = {
  Normal = { fg = palette.default, bg = palette.bg },

  WinBar = { fg = palette.ui, bg = palette.bg },
  WinBarNC = { link = "WinBar" },
  Comment = { fg = palette.low },
  Visual = { bg = palette.visual_bg },

  Identifier = { fg = palette.default },
  Function = { fg = palette.default },
  Constant = { fg = palette.default },
  String = { fg = palette.default },
  Statement = { fg = palette.default },
  Variable = { fg = palette.default },
  PreProc = { fg = palette.default },
  Type = { fg = palette.default },
  Todo = { fg = palette.default },

  Special = { fg = palette.low },
  Operator = { fg = palette.low },
  Search = { fg = palette.search, bg = palette.bg },
  CurSearch = { fg = palette.search, bg = palette.bg, underline = true },

  -- set

  DiagnosticError = { fg = palette.error },
  DiagnosticWarn = { fg = palette.warning },
  DiagnosticInfo = { fg = palette.info },
  DiagnosticHint = { fg = palette.hint },

  DiagnosticUnderlineError = { undercurl = true, sp = palette.error },
  DiagnosticUnderlineWarn = { undercurl = true, sp = palette.warning },
  DiagnosticUnderlineInfo = { undercurl = true, sp = palette.info },
  DiagnosticUnderlineHint = { undercurl = true, sp = palette.hint },
  DiagnosticUnnecessary = { link = "DiagnosticUnderlineHint" },

  -- lsp
  ["@punctuation"] = { link = "Special" },
  ["@variable"] = { link = "Variable" },

  -- sql
  ["@type.builtin.sql"] = { fg = palette.default },

  -------------
  -- plugins --
  -------------

  -- DropBar
  Directory = { fg = palette.folder },

  -- MiniFiles
  MiniFilesDirectory = { fg = palette.folder },
  MiniFilesNormal = { fg = palette.ui },
  MiniFilesBorder = { fg = palette.border },
  MiniFilesCursorLine = { bg = palette.visual_bg },

  -- Telescope
  TelescopeNormal = { fg = palette.ui, bg = palette.bg },
  TelescopeBorder = { fg = palette.border },
  TelescopeSelection = { bg = palette.visual_bg },
}

-- colorschme load
if vim.g.colors_name then
  vim.cmd "hi clear"
  if package.loaded["nvim-web-devicons"] then
    -- require("nvim-web-devicons").refresh()
  end
end

vim.g.termguicolors = true
vim.g.colors_name = "mytheme"

for group, opts in pairs(hl) do
  vim.api.nvim_set_hl(0, group, opts)
end
