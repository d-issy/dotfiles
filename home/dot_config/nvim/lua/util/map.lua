--- @class util.keymap
local M = {}

local array = require "util.array"

--- @class util.keymap.KeyMapTable
--- @field [1] string lhs
--- @field [2]? string|fun() rhs
--- @field [3]? table opts
--- @field mode? string|string[]
--- @field desc? string

--- @param keys util.keymap.KeyMapTable[]
--- @param default_opts table?
function M.setup(keys, default_opts)
  for _, key in ipairs(keys) do
    local mode = key.mode and array.new(key.mode) or { "n" }
    local opts = vim.tbl_deep_extend("force", {
      silent = true,
      noremap = true,
      desc = key.desc,
    }, default_opts or {}, key[3] or {})

    vim.keymap.set(mode, key[1], key[2], opts)
  end
end

return M
