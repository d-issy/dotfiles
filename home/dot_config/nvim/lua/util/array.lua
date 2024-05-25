local M = {}

---@generic T
---@param value? T|T[]
---@return T[]
function M.of(value)
  if value == nil or value == vim.NIL then
    return {}
  elseif type(value) == "table" then
    return value
  end
  return { value }
end

return M
