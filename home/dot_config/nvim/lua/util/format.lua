--- @class util.format
local M = {}

--- Check if autoformat is enabled
--- @return boolean
function M.enabled()
  local buf = vim.api.nvim_get_current_buf()

  local g = vim.g.autoformat
  local b = vim.b[buf].autoformat

  if b ~= nil then
    return b
  end

  -- default true
  return g == nil or g
end

--- Toggle autoformat
--- @param buf? boolean
function M.toggle(buf)
  local autoformat = not M.enabled()
  local msg = autoformat and "enabled" or "disabled"

  if buf then
    vim.b.autoformat = autoformat
    vim.api.nvim_notify(msg, vim.log.levels.INFO, { title = "Autoformat (buffer)" })
  else
    vim.g.autoformat = autoformat
    vim.b.autoformat = nil
    vim.api.nvim_notify(msg, vim.log.levels.INFO, { title = "Autoformat (global)" })
  end
end

return M
