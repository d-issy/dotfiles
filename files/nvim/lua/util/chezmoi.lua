---@class util.chezmoi
local M = {}

local log = require "util.log"

M.pattern = os.getenv "HOME" .. "/.local/share/chezmoi/home/*"

-- Check if chezmoi is installed.
---@return boolean
function M.is_installed()
  return vim.fn.executable "chezmoi" == 1
end

-- Check if chezmoi is enabled.
---@return boolean
function M.is_enabled()
  if not M.is_installed() then
    return false
  end
  return vim.g.chezmoi == nil or vim.g.chezmoi
end

-- Toggle chezmoi.
function M.toggle()
  local enabled = not M.is_enabled()
  vim.g.chezmoi = enabled
  if enabled then
    log.info("Enabled", "chezmoi")
  else
    log.warn("Disabled", "chezmoi")
  end
end

-- Apply chezmoi.
function M.apply()
  if not M.is_enabled() then
    return
  end
  local out = vim.fn.trim(vim.fn.system { "chezmoi", "apply", "--verbose", "--force" })
  log.info(out, "chezmoi title")
end

return M
