local array = require "util.array"
local tmux = require "util.tmux"

local M = {}

---@param cmd? string[]|string
function M.open(cmd)
  if tmux.is_enabled() then
    tmux.popup(cmd)
  else
    require("lazyvim.util").terminal.open(array.of(cmd))
  end
end

return M
