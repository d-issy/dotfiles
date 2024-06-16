local M = {}

function M.refresh()
  vim.cmd "checktime"
end

return M
