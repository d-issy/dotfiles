local tmux = require "util.tmux"

local M = {}

---@param cmd? string[]|string
---@param opts? table
function M.open(cmd, opts)
  if tmux.is_enabled() then
    tmux.popup(cmd, opts)
  else
    require("lazyvim.util").terminal.open(cmd, opts)
  end
end

return M
