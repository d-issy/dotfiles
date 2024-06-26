local array = require "util.array"

---@class util.tmux
local M = {}

---@return boolean
function M.is_enabled()
  return vim.fn.getenv "TMUX" ~= vim.NIL
end

---@param cmd? string|string[]
---@param opts? table
function M.popup(cmd, opts)
  local tmux_popup = {
    "tmux",
    "popup",
    "-d",
    opts and opts.cwd or "#{pane_current_path}",
    "-h",
    "95%",
    "-w",
    "95%",
    "-E",
  }
  vim.fn.system(vim.list_extend(tmux_popup, array.new(cmd)))
end

return M
