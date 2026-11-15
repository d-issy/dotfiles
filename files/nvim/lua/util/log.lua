---@class util.log
local M = {}

--- @enum (key) util.log.LEVELS
M.levels = {
  debug = vim.log.levels.DEBUG,
  trace = vim.log.levels.TRACE,
  info = vim.log.levels.INFO,
  warn = vim.log.levels.WARN,
  error = vim.log.levels.ERROR,
}

-- log with level
--- @param level util.log.LEVELS
--- @param msg string
--- @param title? string
function M.with(level, msg, title)
  -- if msg is empty, do nothing
  if msg == "" then
    return
  end
  vim.notify(msg, M.levels[level], { title = title })
end

return M
