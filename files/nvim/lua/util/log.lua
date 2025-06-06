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
  vim.api.nvim_notify(msg, M.levels[level], { title = title })
end

--- @param msg string
--- @param title? string
function M.info(msg, title)
  M.with("info", msg, title)
end

--- @param msg string
--- @param title? string
function M.warn(msg, title)
  M.with("warn", msg, title)
end

--- @param msg string
--- @param title? string
function M.error(msg, title)
  M.with("error", msg, title)
end

return M
