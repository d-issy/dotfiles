--- @class util.array
local M = {}

--- Create new array.
--- @generic T
--- @param value? T|T[]
--- @return T[]
function M.new(value)
  if value == nil or value == vim.NIL then
    return {}
  elseif type(value) == "table" then
    return value
  end
  return { value }
end

return M
