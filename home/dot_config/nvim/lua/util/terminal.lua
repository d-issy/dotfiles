local tmux = require "util.tmux"
local array = require "util.array"

---@class util.terminal
local M = {}

---@class util.terminal.CmdOptions
---@field cwd? string
---@field env? table<string,string>

--- run command
---@param cmd string|string[]
---@param opts? util.terminal.CmdOptions
function M.run(cmd, opts)
  opts = opts or {}

  if tmux.is_enabled() then
    tmux.popup(cmd, opts)
  else
    require("lazy.util").float_term(array.new(cmd), opts)
  end
end

return M
