---@class util.tmux
local M = {}

local array = require "util.array"

--- Check if tmux is enabled.
--- @return boolean
function M.is_enabled()
  return vim.fn.getenv "TMUX" ~= vim.NIL
end

--- Run command in tmux popup.
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
