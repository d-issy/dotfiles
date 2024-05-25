local M = {}

function M.open()
  require("util.terminal").open "lazygit"
  require("util.git").refresh()
end

return M
