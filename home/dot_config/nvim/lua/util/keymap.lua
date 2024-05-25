local M = {}

---@class KeymapOption
---@field mods? string|string[]
---@field remap? boolean

---@param key string
---@param fn string|function
---@param desc string
---@param opts? KeymapOption
M.set = function(key, fn, desc, opts)
  local mods = opts and opts.mods or { "n" }
  opts = vim.tbl_deep_extend("force", { silent = true, desc = desc }, opts or {})
  vim.keymap.set(mods, key, fn, opts)
end

---@param key string
---@param mode? string|string[]
M.delete = function(key, mode)
  mode = mode or { "n" }
  vim.keymap.del(mode, key)
end

return M
