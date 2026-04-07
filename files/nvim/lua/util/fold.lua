--- @class util.fold
local M = {}

--- foldexpr
function M.expr()
  local buf = vim.api.nvim_get_current_buf()

  if vim.treesitter.get_parser(buf) then
    return vim.treesitter.foldexpr()
  end
  return "0"
end

return M
