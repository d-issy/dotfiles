---@class util.chezmoi
local M = {}

M.pattern = os.getenv "HOME" .. "/.local/share/chezmoi/home/*"

--- Check if chezmoi is enabled.
--- @return boolean
function M.is_enabled()
  return vim.fn.executable "chezmoi" == 1
end

--- Apply chezmoi.
function M.apply()
  if not M.is_enabled() then
    return
  end
  local out = vim.fn.trim(vim.fn.system { "chezmoi", "apply", "--verbose", "--force" })
  if out == "" then
    return
  end
  vim.api.nvim_notify(out, vim.log.levels.INFO, { title = "chezmoi apply" })
end

return M
