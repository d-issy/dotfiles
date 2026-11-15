--- @class util.tmux
local M = {}

local array = require "util.array"

--- Check if tmux is enabled.
--- @return boolean
function M.is_enabled()
  return vim.fn.getenv "TMUX" ~= vim.NIL
end

--- Run command in tmux popup.
--- @param cmd? string|string[]
--- @param opts? table
function M.popup(cmd, opts)
  opts = opts or {}
  local cwd = opts.cwd or vim.uv.cwd()
  local tmux_popup = { "tmux", "popup", "-d", cwd, "-h", "95%", "-w", "95%" }
  for key, value in pairs(opts.env or {}) do
    vim.list_extend(tmux_popup, { "-e", key .. "=" .. value })
  end
  table.insert(tmux_popup, "-E")
  vim.fn.system(vim.list_extend(tmux_popup, array.new(cmd)))
end

return M
