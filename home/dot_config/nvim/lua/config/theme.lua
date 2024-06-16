local c = {
  bg = "#212529",

  p1 = "#f8f9fa",
  p2 = "#ced4da",
  p3 = "#6c757d",

  blue = "#a3cef1",
}

local hls = {}

-- colorschme load
vim.cmd "hi clear"
for group, opts in pairs(hls) do
  vim.api.nvim_set_hl(0, group, { bg = opts.bg, fg = opts.fg })
end
