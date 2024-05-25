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

---@generic T
---@param t1 T[]
---@param t2 T[]
---@return T[]
function M.concat(t1, t2)
  for i = 1, #t2 do
    t1[#t1 + 1] = t2[i]
  end
  return t1
end

return M
