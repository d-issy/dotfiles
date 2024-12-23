local palette = {
  none = "NONE",

  bg = "#282828",
  default = "#f9f9f9",

  border = "#8c8c8c",

  ui = "#cfcfcf",
  visual = "#454545",
  cursor = "#383838",

  low = "#8c8c8c",
  search = "#f2f2aa",

  error = "#ed8796",
  warning = "#eed49f",
  info = "#7dc4e4",
  hint = "#8aadf4",

  folder = "#54aeff",

  add = "#a3be8c",
  change = "#ebcb8b",
  delete = "#bf616a",
  diff_text = "#81a1c1",

  add_bg = "#204510",
  change_bg = "#605000",
  delete_bg = "#9f514a",
}

local hl = {
  Normal = { fg = palette.default, bg = palette.bg },

  CursorLine = { bg = palette.cursor },
  NCursorLine = { link = "CursorLine" },

  NormalFloat = { bg = palette.bg },
  FloatBorder = { fg = palette.border },

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

  Whitespace = { bg = palette.visual },

  PMenu = { fg = palette.default, bg = palette.bg },

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
  ["@lsp.typemod.keyword.documentation"] = { fg = palette.default },
  ["@lsp.type.type"] = { fg = palette.low },

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
  MiniFilesCursorLine = { bg = palette.visual },
  MiniFilesAdd = { fg = palette.add },
  MiniFilesChange = { fg = palette.change },

  -- MiniIcons
  MiniIconsAzure = { fg = palette.folder },
  MiniIconsBlue = { fg = palette.info },
  MiniIconsCyan = { fg = palette.hint },
  MiniIconsGreen = { fg = palette.add },
  MiniIconsGrey = { fg = palette.low },
  MiniIconsOrange = { fg = palette.warning },
  MiniIconsPurple = { fg = palette.low },
  MiniIconsRed = { fg = palette.error },
  MiniIconsYellow = { fg = palette.change },

  -- BlinkCmp
  BlinkCmpDoc = { fg = palette.default },
  BlinkCmpDocBorder = { fg = palette.border },
  BlinkCmpGhostText = { fg = palette.low },

  BlinkCmpLabel = { fg = palette.default, bg = palette.none },
  BlinkCmpLabelDeprecated = { link = "DiagnosticDeprecated" },

  BlinkCmpMenu = { fg = palette.ui, bg = palette.none },

  BlinkCmpKind = { fg = palette.ui, bg = palette.none },
  BlinkCmpKindCopilot = { fg = "#6cc644", bg = palette.none },

  -- TreeSitter
  TreeSitterContext = { bg = palette.cursor },

  -- GitSigns
  GitSignsAdd = { fg = palette.add },
  GitSignsChange = { fg = palette.change },
  GitSignsDelete = { fg = palette.delete },

  -- DiffView
  DiffviewFolderSign = { fg = palette.folder },
  DiffviewFilePanelInsertions = { fg = palette.add },
  DiffViewFilePanelDeletions = { fg = palette.delete },
  diffAdded = { fg = palette.add },
  diffChanaged = { fg = palette.change },
  diffRemoved = { fg = palette.delete },

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

  DiffAdd = { bg = palette.add_bg },
  DiffChange = { bg = palette.change_bg },
  DiffDelete = { bg = palette.delete_bg },
  DiffText = { fg = palette.bg, bg = palette.change },
}

-- colorschme load
if vim.g.colors_name then
  vim.cmd "hi clear"
  vim.opt.termguicolors = true
end

vim.g.colors_name = "mytheme"

for group, opts in pairs(hl) do
  vim.api.nvim_set_hl(0, group, opts)
end
