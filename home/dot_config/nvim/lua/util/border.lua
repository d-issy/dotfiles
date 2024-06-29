---@class util.border
local M = {}

---Generate Border Setting
---@param hl_name? string
---@return table
function M.generate(hl_name)
  hl_name = hl_name or ""
  return {
    { "╭", hl_name },
    { "─", hl_name },
    { "╮", hl_name },
    { "│", hl_name },
    { "╯", hl_name },
    { "─", hl_name },
    { "╰", hl_name },
    { "│", hl_name },
  }
end

return M
