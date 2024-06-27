local palette = {
  none = "NONE",

  bg = "#282828",
  default = "#9c9c9c",

  border = "#ffffff",

  ui = "#cfcfcf",
  visual = "#383838",
  cursor = "#323232",

  low = "#686868",
  search = "#f2f2aa",
  cmp = "#f9f9f9",

  error = "#ed8796",
  warning = "#eed49f",
  info = "#7dc4e4",
  hint = "#8aadf4",

  folder = "#54aeff",

  add = "#a3be8c",
  change = "#ebcb8b",
  delete = "#bf616a",
}

local hl = {
  Normal = { fg = palette.default, bg = palette.bg },

  CursorLine = { bg = palette.cursor },
  NCursorLine = { link = "CursorLine" },

  WinBar = { fg = palette.ui, bg = palette.bg },
  WinBarNC = { link = "WinBar" },
  Comment = { fg = palette.low },
  Visual = { bg = palette.visual },
  Search = { fg = palette.search, bg = palette.bg },
  CurSearch = { fg = palette.search, bg = palette.bg, underline = true },

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
  Keyword = { fg = palette.low },
  Operator = { fg = palette.low },

  ---------
  -- lsp --
  ---------

  -- lsp
  ["@punctuation"] = { link = "Special" },
  ["@variable"] = { link = "Variable" },
  ["@function.builtin"] = { link = "Function" },
  ["@constant.builtin"] = { link = "Constant" },
  ["@module"] = { fg = palette.low },
  ["@lsp.mod.global"] = { fg = palette.low },
  ["@lsp.mod.defaultLibrary"] = { fg = palette.low },

  -- go
  ["@variable.parameter.go"] = { fg = palette.low },
  ["@property.go"] = { fg = palette.low },

  -- python
  ["@lsp.type.namespace.python"] = { fg = palette.default },

  -- sql
  ["@type.builtin.sql"] = { fg = palette.default },

  -------------
  -- plugins --
  -------------

  -- Copilot
  CopilotSuggestion = { fg = palette.low },
  CopilotAnnotation = { fg = palette.ui },

  -- DropBar
  Directory = { fg = palette.folder },

  -- MiniFiles
  MiniFilesDirectory = { fg = palette.folder },
  MiniFilesNormal = { fg = palette.ui },
  MiniFilesBorder = { fg = palette.border },
  MiniFilesCursorLine = { bg = palette.visual },

  -- Cmp
  CmpDocumentation = { fg = palette.default },
  CmpDocumentationBorder = { fg = palette.border },
  CmpGhostText = { fg = palette.low },

  CmpItemAbbr = { fg = palette.default, bg = palette.none },
  CmpItemAbbrDeprecated = { link = "DiagnosticDeprecated" },

  CmpItemMenu = { fg = palette.ui, bg = palette.none },

  CmpItemKind = { fg = palette.ui, bg = palette.none },
  CmpItemKindCopilot = { fg = "#6cc644", bg = palette.none },

  -- Telescope
  TelescopeNormal = { fg = palette.ui, bg = palette.bg },
  TelescopeBorder = { fg = palette.border },
  TelescopeSelection = { bg = palette.visual },
  TelescopeMatching = { fg = palette.search },

  -- TreeSitter
  TreeSitterContext = { bg = palette.cursor },

  -- GitSigns
  GitSignsAdd = { fg = palette.add },
  GitSignsChange = { fg = palette.change },
  GitSignsDelete = { fg = palette.delete },

  -----------
  -- other --
  -----------
  DiagnosticError = { fg = palette.error },
  DiagnosticWarn = { fg = palette.warning },
  DiagnosticInfo = { fg = palette.info },
  DiagnosticHint = { fg = palette.hint },

  DiagnosticUnderlineError = { undercurl = true, sp = palette.error },
  DiagnosticUnderlineWarn = { undercurl = true, sp = palette.warning },
  DiagnosticUnderlineInfo = { undercurl = true, sp = palette.info },
  DiagnosticUnderlineHint = { undercurl = true, sp = palette.hint },

  DiagnosticUnnecessary = { link = "DiagnosticUnderlineHint" },
  DiagnosticDeprecated = { strikethrough = true, sp = palette.warning },

  DiffAdd = { fg = palette.bg, bg = palette.add },
  DiffChange = { fg = palette.bg, bg = palette.change },
  DiffDelete = { fg = palette.bg, bg = palette.delete },
}

-- colorschme load
if vim.g.colors_name then
  vim.cmd "hi clear"
end

vim.g.colors_name = "mytheme"

for group, opts in pairs(hl) do
  vim.api.nvim_set_hl(0, group, opts)
end
