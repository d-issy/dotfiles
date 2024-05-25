local array = require "util.array"
local M = {}

---@return boolean
function M.is_enabled() return vim.fn.getenv "TMUX" ~= vim.NIL end

---@param cmd? string|string[]
function M.popup(cmd)
  local tmux_popup = {
    "tmux",
    "popup",
    "-d",
    "#{pane_current_path}",
    "-h",
    "95%",
    "-w",
    "95%",
    "-E",
  }
  vim.fn.system(array.concat(tmux_popup, array.of(cmd)))
end

return M
