--- @class util.lazygit
local M = {}

---  lazygit open.
--- @param args? string[]
function M.open(args)
  local cmd = vim.list_extend({ "lazygit" }, args or {})
  require("util.terminal").run(cmd)
  vim.cmd "checktime"
  require("util.chezmoi").apply()
end

--- lazygit file history.
function M.file_history()
  local path = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
  M.open { "-f", vim.fn.trim(path) }
end

--- lazygit commit log.
function M.commit_log()
  M.open { "log" }
end

return M
