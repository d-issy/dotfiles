local M = {}

---@param opts? table
function M.open(opts)
  local cmd = { "lazygit" }
  vim.list_extend(cmd, (opts and opts.args) or {})

  require("util.terminal").open(cmd)
  require("util.git").refresh()
end

function M.file_history()
  local path = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
  M.open { args = { "-f", vim.fn.trim(path) } }
end

return M
