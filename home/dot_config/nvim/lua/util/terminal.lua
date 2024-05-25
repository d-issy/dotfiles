local array = require "util.array"

M = {}

---@return boolean
function M.is_tmux_enabled() return vim.fn.getenv "TMUX" ~= vim.NIL end

---@param cmd? string|string[]
function M.tmux_popup(cmd)
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

---@param cmd? string[]|string
function M.open(cmd)
  if M.is_tmux_enabled() then
    M.tmux_popup(cmd)
  else
    require("lazyvim.util").terminal.open(array.of(cmd))
  end
end

return M
