local M = {}

local startOfLine = function(line)
  return string.match(line, '^%s*%w+$') ~= nil
end

M.OptStartOfLine = {
  condition = startOfLine,
  show_condition = startOfLine,
}

return M
