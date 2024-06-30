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
  vim.notify(out, nil, {
    title = "chezmoi apply",
    render = "wrapped-compact",
    top_down = true,
  })
end

return M
