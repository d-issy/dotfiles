M = {}

---Concatenates two arrays
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
