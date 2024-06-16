local c = {
  bg = "#212529",

  p1 = "#dee2e6",
  p3 = "#6c757d",
  p4 = "#495057",
}

local hls = {
  Normal = { fg = c.p3, bg = c.bg },

  Identifier = { fg = c.p1 },
  String = { fg = c.p1 },

  Keyword = { fg = c.p3 },
  Constant = { fg = c.p1 },

  Comment = { fg = c.p4 },
  MatchParen = { fg = c.p3 },
  Paren = { fg = c.p3 },
  Operator = { fg = c.p3 },
  Variable = { fg = c.p3 },
  Special = { fg = c.p3 },
  SpecialKey = { fg = c.p3 },
  Function = { fg = c.p3 },
}

-- colorschme load
vim.cmd "hi clear"
for group, opts in pairs(hls) do
  vim.api.nvim_set_hl(0, group, { bg = opts.bg, fg = opts.fg })
end
