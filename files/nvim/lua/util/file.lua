--- @class util.file
local M = {}

--- Check if file is big
--- @param buf? number
--- @return boolean
M.is_big = function(buf)
  buf = buf or vim.api.nvim_get_current_buf()
  local file_size = vim.fn.getfsize(vim.fn.bufname(buf))
  return file_size > 1572864 -- 1.5MB
end

return M
