local array = require "util.array"

M = {}

---Open a terminal window with the given command
---@param cmd string[]|string
function M.open(cmd)
  if type(cmd) == "string" then
    cmd = { cmd }
  end

  if vim.fn.getenv "TMUX" then
    local tmux_popup = { "tmux", "popup", "-d", "#{pane_current_path}", "-h", "95%", "-w", "95%", "-E" }
    vim.fn.system(array.concat(tmux_popup, cmd))
  else
    require("lazyvim.util").terminal.open(cmd)
  end
end

return M
