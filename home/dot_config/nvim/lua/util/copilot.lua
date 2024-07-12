--- @class util.copilot
local M = {}

--- Check if copilot is enabled
--- @return boolean
function M.enabled()
  if package.loaded["copilot"] == nil then
    return false
  end
  return vim.g.copilot == nil or vim.g.copilot
end

--- Toggle copilot
function M.toggle()
  vim.g.copilot = not vim.g.copilot
end

--- Enable copilot
function M.on()
  vim.g.copilot = true
end

--- Disable copilot
function M.off()
  vim.g.copilot = false
end

return M
