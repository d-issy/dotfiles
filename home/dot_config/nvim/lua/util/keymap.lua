---@class util.keymap
local M = {}

---@class KeymapOption
---@field mods? string|string[]
---@field remap? boolean
---@field noremap? boolean

---@param key string
---@param fn string|function
---@param desc string
---@param opts? KeymapOption
M.set = function(key, fn, desc, opts)
  local mods = opts and opts.mods or { "n" }
  opts = vim.tbl_deep_extend("force", { silent = true, desc = desc }, opts or {})
  -- delete mods from opts
  opts.mods = nil
  vim.keymap.set(mods, key, fn, opts)
end

---@param key string
---@param mods? string|string[]
M.delete = function(key, mods)
  mods = mods or { "n" }
  vim.keymap.del(mods, key)
end

return M
