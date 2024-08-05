--- @class util.toggle
local M = {}

local log = require "util.log"

--- Toggle vim options
--- @param options string|string[]
--- @return function
function M.option(options)
  if type(options) == "string" then
    options = { options }
  end
  local notify = #options == 1
  return function()
    for _, option in ipairs(options) do
      if vim.opt_local[option]:get() then
        vim.opt_local[option] = false
        if notify then
          log.warn("Disabled", "Option (" .. option .. ")")
        end
      else
        vim.opt_local[option] = true
        if notify then
          log.info("Enabled", "Option (" .. option .. ")")
        end
      end
    end
  end
end

return M
